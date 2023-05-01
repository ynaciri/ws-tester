declare module "solc/linker" {
  export function linkBytecode(
    bytecode: string,
    libraries: Record<string, string>
  ): string;

  export function findLinkReferences(
    bytecode: string
  ): Record<string, { start: number; length: number }[]>;
}
