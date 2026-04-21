import { Contract, ethers } from 'ethers';
import type { Signer } from 'ethers';
import type { SwapExecutionContext, SwapQuoteInput, E3DProviderLike, E3DTokenRef } from './types.js';
import { E3DError } from './errors.js';

const DEFAULT_E3D_TOKEN_ADDRESS = '0x6488861b401F427D13B6619C77C297366bCf6386';
const UNISWAP_V2_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNISWAP_V3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

const V2_ROUTER_ABI = [
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
];

const V3_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
];

type SwapDirection = 'buy' | 'sell';

export interface SwapModuleOptions {
  e3dTokenAddress?: string;
  wethAddress?: string;
  v2RouterAddress?: string;
  v3RouterAddress?: string;
  defaultRouterVersion?: 2 | 3;
}

export interface BuiltSwapTransaction {
  direction: SwapDirection;
  routerVersion: 2 | 3;
  routerAddress: string;
  tokenIn: E3DTokenRef;
  tokenOut: E3DTokenRef;
  amountIn: string;
  amountOutMin: string;
  recipient: string;
  deadline: number;
  needsApproval: boolean;
  approvalSpender?: string;
  transaction: Record<string, unknown>;
}

export class SwapModule {
  private readonly e3dTokenAddress: string;
  private readonly wethAddress: string;
  private readonly v2RouterAddress: string;
  private readonly v3RouterAddress: string;
  private readonly defaultRouterVersion: 2 | 3;

  constructor(private readonly options: SwapModuleOptions = {}) {
    this.e3dTokenAddress = ethers.utils.getAddress(options.e3dTokenAddress || DEFAULT_E3D_TOKEN_ADDRESS);
    this.wethAddress = ethers.utils.getAddress(options.wethAddress || WETH_ADDRESS);
    this.v2RouterAddress = ethers.utils.getAddress(options.v2RouterAddress || UNISWAP_V2_ROUTER_ADDRESS);
    this.v3RouterAddress = ethers.utils.getAddress(options.v3RouterAddress || UNISWAP_V3_ROUTER_ADDRESS);
    this.defaultRouterVersion = options.defaultRouterVersion || 3;
  }

  getSupportedTokens(): E3DTokenRef[] {
    return [
      { symbol: 'ETH', address: 'native', decimals: 18, name: 'Ethereum', isNative: true },
      { symbol: 'WETH', address: this.wethAddress, decimals: 18, name: 'Wrapped Ethereum' },
      { symbol: 'E3D', address: this.e3dTokenAddress, decimals: 18, name: 'E3DToken' },
    ];
  }

  quoteBuyE3D(input: SwapQuoteInput) {
    return this.buildSwapQuote('buy', input);
  }

  quoteSellE3D(input: SwapQuoteInput) {
    return this.buildSwapQuote('sell', input);
  }

  async buyE3D(context: SwapExecutionContext, input: SwapQuoteInput & { recipient?: string } ) {
    return this.executeSwap(context, 'buy', input);
  }

  async sellE3D(context: SwapExecutionContext, input: SwapQuoteInput & { recipient?: string } ) {
    return this.executeSwap(context, 'sell', input);
  }

  async approveInputToken(context: SwapExecutionContext, params: { tokenAddress: string; spender?: string; amount: string | number | bigint }) {
    const signer = this.resolveSigner(context);
    const tokenAddress = ethers.utils.getAddress(params.tokenAddress);
    const spender = ethers.utils.getAddress(params.spender || this.getRouterAddress(this.defaultRouterVersion));
    const token = new Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await token.approve(spender, params.amount);
    return tx;
  }

  async buildSwapTransaction(context: SwapExecutionContext, input: SwapQuoteInput & { direction: SwapDirection; recipient?: string }) {
    return this.buildTransaction(context, input.direction, input);
  }

  async estimateSwap(input: SwapQuoteInput & { direction: SwapDirection }) {
    const quote = this.buildSwapQuote(input.direction, input);
    return quote.amountOutMin;
  }

  private buildSwapQuote(direction: SwapDirection, input: SwapQuoteInput) {
    const routerVersion = input.routerVersion || this.defaultRouterVersion;
    const amountIn = ethers.BigNumber.from(input.amountIn);
    const expected = input.expectedAmountOut ? ethers.BigNumber.from(input.expectedAmountOut) : amountIn;
    const slippageBps = input.slippageBps ?? 0;
    const minOut = expected.mul(10000 - slippageBps).div(10000);

    return {
      direction,
      routerVersion,
      amountIn: amountIn.toString(),
      expectedAmountOut: expected.toString(),
      amountOutMin: minOut.toString(),
      deadlineMinutes: input.deadlineMinutes ?? 30,
    };
  }

  private async executeSwap(context: SwapExecutionContext, direction: SwapDirection, input: SwapQuoteInput & { recipient?: string }) {
    const built = await this.buildTransaction(context, direction, input);
    const signer = this.resolveSigner(context);
    const router = this.getRouterContract(built.routerVersion, signer);
    let receiptTx;

    if (built.needsApproval && built.approvalSpender) {
      const token = new Contract(built.tokenIn.address, ERC20_ABI, signer);
      const allowance = await token.allowance(context.walletAddress, built.approvalSpender);
      const amountIn = ethers.BigNumber.from(built.amountIn);
      if (allowance.lt(amountIn)) {
        await token.approve(built.approvalSpender, ethers.constants.MaxUint256);
      }
    }

    if (built.routerVersion === 3) {
      const params = {
        tokenIn: built.tokenIn.address,
        tokenOut: built.tokenOut.address === 'native' ? this.wethAddress : built.tokenOut.address,
        fee: 3000,
        recipient: built.recipient,
        deadline: built.deadline,
        amountIn: ethers.BigNumber.from(built.amountIn),
        amountOutMinimum: ethers.BigNumber.from(built.amountOutMin),
        sqrtPriceLimitX96: 0,
      };

      receiptTx = built.direction === 'buy' && built.tokenIn.isNative
        ? await router.exactInputSingle(params, { value: ethers.BigNumber.from(built.amountIn) })
        : await router.exactInputSingle(params);
    } else if (built.direction === 'buy' && built.tokenIn.isNative) {
      const path = [this.wethAddress, built.tokenOut.address];
      receiptTx = await router.swapExactETHForTokens(
        ethers.BigNumber.from(built.amountOutMin),
        path,
        built.recipient,
        built.deadline,
        { value: ethers.BigNumber.from(built.amountIn) }
      );
    } else {
      const path = built.direction === 'buy'
        ? [built.tokenIn.address, this.wethAddress, built.tokenOut.address]
        : [built.tokenIn.address, this.wethAddress, built.tokenOut.address === 'native' ? this.wethAddress : built.tokenOut.address];
      receiptTx = await router.swapExactTokensForTokens(
        ethers.BigNumber.from(built.amountIn),
        ethers.BigNumber.from(built.amountOutMin),
        path,
        built.recipient,
        built.deadline
      );
    }

    return receiptTx;
  }

  private async buildTransaction(context: SwapExecutionContext, direction: SwapDirection, input: SwapQuoteInput & { recipient?: string }) {
    const routerVersion = input.routerVersion || this.defaultRouterVersion;
    const amountIn = ethers.BigNumber.from(input.amountIn);
    const expected = input.expectedAmountOut ? ethers.BigNumber.from(input.expectedAmountOut) : amountIn;
    const slippageBps = input.slippageBps ?? 0;
    const amountOutMin = expected.mul(10000 - slippageBps).div(10000);
    const tokenIn = this.resolveToken(direction === 'buy' ? input.inputToken : this.e3dTokenRef(input.inputToken));
    const tokenOut = this.resolveToken(direction === 'buy' ? this.e3dTokenRef(input.outputToken) : input.outputToken);
    const recipient = input.recipient || context.walletAddress;
    const deadline = Math.floor(Date.now() / 1000) + ((input.deadlineMinutes ?? 30) * 60);
    const routerAddress = this.getRouterAddress(routerVersion);
    const needsApproval = !tokenIn.isNative && tokenIn.address !== 'native';

    const transaction: Record<string, unknown> = {
      from: context.walletAddress,
      to: routerAddress,
      value: tokenIn.isNative ? amountIn.toHexString() : '0x0',
    };

    const built: BuiltSwapTransaction = {
      direction,
      routerVersion,
      routerAddress,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOutMin: amountOutMin.toString(),
      recipient,
      deadline,
      needsApproval,
      transaction,
    };

    if (needsApproval) {
      built.approvalSpender = routerAddress;
    }

    return built;
  }

  private resolveToken(token?: E3DTokenRef | string): E3DTokenRef {
    if (!token) return this.e3dTokenRef();
    if (typeof token === 'string') {
      if (token === 'native' || token.toUpperCase() === 'ETH') {
        return { symbol: 'ETH', address: 'native', decimals: 18, name: 'Ethereum', isNative: true };
      }
      if (token.toUpperCase() === 'WETH') {
        return { symbol: 'WETH', address: this.wethAddress, decimals: 18, name: 'Wrapped Ethereum' };
      }
      if (token.toUpperCase() === 'E3D') {
        return this.e3dTokenRef();
      }
      return { symbol: token.toUpperCase(), address: token, decimals: 18 };
    }
    if (token.address === 'native' || token.isNative) {
      return { ...token, symbol: token.symbol || 'ETH', address: 'native', decimals: token.decimals ?? 18, isNative: true };
    }
    return { ...token, address: ethers.utils.getAddress(token.address), decimals: token.decimals ?? 18 };
  }

  private e3dTokenRef(input?: E3DTokenRef | string): E3DTokenRef {
    if (input && typeof input === 'object') return this.resolveToken(input);
    return { symbol: 'E3D', address: this.e3dTokenAddress, decimals: 18, name: 'E3DToken' };
  }

  private getRouterAddress(version: 2 | 3): string {
    return version === 2 ? this.v2RouterAddress : this.v3RouterAddress;
  }

  private getRouterContract(version: 2 | 3, signer: Signer) {
    const abi = version === 2 ? V2_ROUTER_ABI : V3_ROUTER_ABI;
    return new Contract(this.getRouterAddress(version), abi, signer);
  }

  private resolveSigner(context: SwapExecutionContext): Signer {
    if (context.signer) return context.signer as Signer;
    if (!context.provider.getSigner) {
      throw new E3DError('A signer or provider.getSigner() is required for swap execution', 'SWAP_ERROR');
    }
    const signer = context.provider.getSigner();
    if (!signer) {
      throw new E3DError('Unable to resolve a signer for swap execution', 'SWAP_ERROR');
    }
    return signer as Signer;
  }
}
