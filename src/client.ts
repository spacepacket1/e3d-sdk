import { HttpClient } from './http.js';
import { DiscoveryModule } from './discovery.js';
import { TokensModule } from './tokens.js';
import { TokenIntelligenceModule } from './tokenIntelligence.js';
import { StoriesModule } from './stories.js';
import { ThesesModule } from './theses.js';
import { AuthModule } from './auth.js';
import { SwapModule, type SwapModuleOptions } from './swap.js';
import type { E3DClientOptions } from './types.js';

export interface E3DOptions extends E3DClientOptions {
  swap?: SwapModuleOptions;
}

export class E3D {
  readonly http: HttpClient;
  readonly discovery: DiscoveryModule;
  readonly tokens: TokensModule;
  readonly swap: SwapModule;
  readonly stories: StoriesModule;
  readonly theses: ThesesModule;
  readonly tokenIntelligence: TokenIntelligenceModule;
  readonly auth: AuthModule;

  constructor(options: E3DOptions = {}) {
    this.http = new HttpClient(options);
    this.discovery = new DiscoveryModule(this.http);
    this.tokens = new TokensModule(this.http);
    this.swap = new SwapModule(options.swap || {});
    this.stories = new StoriesModule(this.http);
    this.theses = new ThesesModule(this.http);
    this.tokenIntelligence = new TokenIntelligenceModule(this.http);
    this.auth = new AuthModule(this.http);
  }
}
