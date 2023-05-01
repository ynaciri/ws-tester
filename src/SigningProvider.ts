import { EventFilter, ethers } from "ethers";
import { EventsProvider } from "./EventsProvider";
import SampleContract from "./contracts/SampleContract.json";

export class SigningProvider {
  private stop = false;

  wallet: ethers.Wallet | undefined;
  provider: ethers.providers.JsonRpcProvider | undefined;
  eventsListener: EventsProvider | undefined;
  address: string | undefined;
  contract: ethers.Contract | undefined;
  minedDate: Record<string, Date> = {};
  startBlockNumber = -1;
  lastBlockNumber = -1;

  constructor() {
    this.init();
  }

  init() {
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.SIGNER_RPC_URL!
    );
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);

    this.wallet
      .getBalance()
      .then((balance) =>
        console.log(
          "current account balance is",
          ethers.utils.formatEther(balance)
        )
      );

    this.deployContract()
      .then(([address, blockNumber]) => {
        this.address = address;
        this.startBlockNumber = blockNumber;
        return this.onContractDeployed(address);
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 3000)))
      .then(() => this.loop())
      .then(() => console.log("loop ended"))
      .catch((err) => console.error("loop failure", err));
  }

  async loop() {
    while (!this.stop) {
      let addCount = Math.floor(Math.random() * 10) + 1;

      console.log("ADD", addCount);
      let tx = await this.contract!.add(addCount);
      console.log("add tx=", tx.hash);
      await tx.wait();
      this.minedDate[tx.hash] = new Date();
      console.log(
        this.minedDate[tx.hash].toISOString(),
        "add tx mined",
        tx.hash
      );

      await new Promise((resolve) => setTimeout(resolve, 30000));

      let subCount = Math.floor(Math.random() * addCount) + 1;

      console.log("SUB", subCount);
      tx = await this.contract!.sub(subCount);
      console.log("sub tx=", tx.hash);
      await tx.wait();
      this.minedDate[tx.hash] = new Date();
      console.log(
        this.minedDate[tx.hash].toISOString(),
        "sub tx mined",
        tx.hash
      );

      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  private async deployContract(): Promise<[string, number]> {
    const { chainId } = await this.wallet!.provider.getNetwork();

    console.log("deploying contract on", chainId);

    const bytecode = SampleContract.evm.bytecode.object;

    const contractFactory = new ethers.ContractFactory(
      SampleContract.abi,
      bytecode,
      this.wallet
    );
    console.log("contract instantiated, sending deploy tx");

    let instance;
    try {
      instance = await contractFactory.deploy();
      console.log(
        "deploy tx :",
        `${process.env.EXPLORER_URL!}/tx/${instance.deployTransaction.hash}`
      );
      await instance.deployTransaction.wait();
      const address = instance.address;
      return [address, await this.wallet!.provider.getBlockNumber()];
    } catch (err) {
      if (instance) {
        console.warn("deploy tx:", instance.deployTransaction);
      }
      throw new Error("DEPLOYMENT_ERROR");
    }
  }

  private async onContractDeployed(address: string) {
    console.log("Contract successfully deployed at", address);

    this.contract = new ethers.Contract(
      address,
      SampleContract.abi,
      this.wallet
    );
    this.eventsListener = new EventsProvider(address, this);

    console.log(
      "everything is set up, starting testing phase at block",
      this.startBlockNumber
    );

    this.setProcessEnd();
  }

  private setProcessEnd() {
    setTimeout(async () => {
      console.log("ending the test");
      this.stop = true;

      console.log("checking missed events");

      const eventFilter: EventFilter = {
        address: this.address,
      };

      try {
        const allEvents = await this.contract!.queryFilter(
          eventFilter,
          this.startBlockNumber
        );

        console.log("listed", allEvents.length, "events");

        const missedEvents = allEvents.filter(
          (log) => !this.eventsListener!.eventAlreadyReceived(log)
        );

        if (missedEvents.length === 0) {
          console.log("All events have been processed !");
        } else {
          console.log("SOME EVENTS WERE MISSED !");
          missedEvents.forEach(console.log);
        }
      } catch (err) {
        console.error("error occured while loading all events", err);
      }

      try {
        await this.eventsListener!.destroy();
      } catch (err) {
        console.error(
          "error occured while disposing of the events listener",
          err
        );
      }
    }, 3600000);

    console.log("created timer to end testing after 1 hour");
  }
}
