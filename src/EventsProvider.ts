import { BigNumber, EventFilter, ethers } from "ethers";
import { WebSocket } from "ws";
import { SigningProvider } from "./SigningProvider";
import SampleContract from "./contracts/SampleContract.json";

export class EventsProvider {
  private readonly readyStateMap: Record<number, string> = {
    [WebSocket.CLOSED]: "CLOSED",
    [WebSocket.CLOSING]: "CLOSING",
    [WebSocket.CONNECTING]: "CONNECTING",
    [WebSocket.OPEN]: "OPEN",
  };

  readonly address: string;

  provider: ethers.providers.WebSocketProvider | undefined;
  contract: ethers.Contract | undefined;
  seenEventsSet: ethers.providers.Log[] = [];
  lastEventBlock = 0;

  wsInterval: NodeJS.Timer | null = null;
  previousReadyState: number = -1;

  pingTimeout: NodeJS.Timeout | null = null;
  keepAliveInterval: NodeJS.Timer | null = null;
  readonly signer: SigningProvider;

  constructor(address: string, signer: SigningProvider) {
    this.address = address;
    this.signer = signer;

    this.init();
  }

  init(restart = false) {
    if (this.provider !== undefined)
      throw new Error("Init called but listener is already running !");

    this.provider = new ethers.providers.WebSocketProvider(
      process.env.JSON_RPC_URL!
    );

    this.wsInterval = setInterval(() => {
      if (this.previousReadyState !== this.provider!.websocket.readyState) {
        this.previousReadyState = this.provider!.websocket.readyState;
        console.log(
          "ready state changed to",
          this.readyStateMap[this.previousReadyState],
          this.previousReadyState
        );
      }

      if (
        this.previousReadyState === WebSocket.CLOSED &&
        this.wsInterval !== null
      ) {
        clearInterval(this.wsInterval);
        this.wsInterval = null;
      }
    }, 1000);

    this.provider._websocket.on("open", () => {
      console.log("websocket provider connected, starting keep alive");
      console.log("initializing events listeners");
      this.initContract(restart);
    });

    this.provider._websocket.on("close", () => {
      console.error("The websocket connection was closed");
      this.destroy().then(() => {
        console.log("cleanup done, reconnecting to websocket provider");
        return this.init(true);
      });
    });

    console.log("websocket provider watchdogs setup done");
  }

  async initContract(restart = false) {
    this.contract = new ethers.Contract(
      this.address,
      SampleContract.abi,
      this.provider
    );

    if (restart) {
      await this.syncEvents();
    }

    this.bindEvents();
  }

  async syncEvents() {
    const eventFilter: EventFilter = {
      address: this.address,
    };

    console.log("querying for missed events during downtime");

    const missedEvents = await this.contract!.queryFilter(
      eventFilter,
      this.lastEventBlock
    );
    if (missedEvents === null) {
      console.error(
        "Querying missed events returned null instead of empty list !"
      );
      return;
    }

    console.log("loaded missed events", missedEvents.length);

    const reallyMissedEvents = missedEvents.filter(
      (log) => !this.eventAlreadyReceived(log)
    );

    console.log(
      "running on",
      reallyMissedEvents.length,
      "really missed events after dedup"
    );

    reallyMissedEvents.forEach((log) => this.eventListener(log));
  }

  bindEvents() {
    const eventFilter: EventFilter = {
      address: this.address,
    };

    this.contract!.on(eventFilter, (log: ethers.providers.Log) => {
      this.eventListener(log);
    });

    console.log("subscribed to events notifications on", this.address);
  }

  eventListener(log: ethers.providers.Log) {
    const now = new Date();
    const event = this.contract!.interface.parseLog(log);
    console.log(
      now.toISOString(),
      "received event notification for :",
      event.name,
      this.convertArgs(...event.args),
      "block=",
      log.blockNumber,
      "tx=",
      log.transactionHash,
      "idx=",
      log.logIndex,
      "delay since mined (s) :",
      this.signer.minedDate[log.transactionHash] !== undefined
        ? (now.getTime() -
            this.signer.minedDate[log.transactionHash].getTime()) /
            1000
        : "unknown"
    );

    if (!this.eventAlreadyReceived(log)) {
      this.seenEventsSet.push(log);

      if (log.blockNumber < this.lastEventBlock) {
        console.warn("this event was notified in the past !");
      } else if (log.blockNumber > this.lastEventBlock) {
        this.lastEventBlock = log.blockNumber;
      }
    } else {
      console.warn(
        "already seen this event:",
        `block: ${log.blockNumber} tx: ${log.transactionHash} idx: ${log.logIndex}`
      );
    }
  }

  private convertArgs(...args: any[]) {
    return args.map((arg) => (arg instanceof BigNumber ? arg.toString() : arg));
  }

  eventAlreadyReceived(log: ethers.providers.Log): boolean {
    return this.seenEventsSet.find((o) => this.logsEqual(o, log)) !== undefined;
  }

  private logsEqual(a: ethers.providers.Log, b: ethers.providers.Log): boolean {
    return (
      a.blockNumber === b.blockNumber &&
      a.transactionIndex === b.transactionIndex &&
      a.logIndex === b.logIndex
    );
  }

  async destroy() {
    if (this.keepAliveInterval !== null) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.pingTimeout !== null) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    if (this.wsInterval !== null) {
      clearInterval(this.wsInterval);
      this.wsInterval = null;
    }

    if (this.provider !== undefined) {
      await this.provider.destroy();
    }

    this.contract = undefined;
    this.previousReadyState = -1;
    this.provider = undefined;
  }
}
