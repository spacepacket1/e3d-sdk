declare module 'ethers' {
  export const ethers: any;
  export class Contract {
    constructor(...args: any[]);
    [key: string]: any;
  }
  export namespace ethers {
    const utils: any;
    const constants: any;
    const BigNumber: any;
    const providers: any;
    type Signer = any;
    type providers = any;
  }
  export namespace providers {
    type Provider = any;
  }
  export type BigNumberish = any;
  export type Signer = any;
}
