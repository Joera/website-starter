import { LocalConfigBuilder } from "./local-config-builder";
import { getProtocolInfo } from "./protocol";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_ABILITY, LIT_NETWORK, LIT_RPC } from "@lit-protocol/constants";
import * as ethers from "ethers";
import { ethers as ethers5, Wallet as Wallet5, providers } from "ethers5";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import {
  LitPKPResource,
  LitActionResource,
  createSiweMessageWithResources,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";

const epk = process.env.PRIVATE_KEY_UNAMORE || process.env.PRIVATE_KEY || "";
const SELECTED_LIT_NETWORK = LIT_NETWORK.Datil;

export class MainController {

    protocolInfo: any;
    builder: any;
    litNodeClient: any; 
    ethersWallet: any;
    sessionSignatures: any;

    constructor() {

    }

    async init() {

        this.protocolInfo = await getProtocolInfo();

        this.builder = new LocalConfigBuilder(
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0MzNhYjNkMS02YTZjLTQzMGUtODhkZC03Yzc0Y2MyZmQzMDkiLCJlbWFpbCI6ImpvZXJhQGpvZXJhbXVsZGVycy5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNDdlMTk2ZDI2ODNjMzNhMWJmNDUiLCJzY29wZWRLZXlTZWNyZXQiOiI4MjE0NDY0YTAyOTlmMmE1OGU4MzcwNWI4NWYxNTNjMTQ1Mzc2YWY3ODc1N2ZjOWI5NTM3YjBjNWFiZGQyNWY0IiwiZXhwIjoxNzc1MDU1NTAyfQ.PnFMDGxYGbzfqFjcENNgSEi393Pi5qE0ebZPOBEJUVk',
            this.protocolInfo.assets_gateway,
            this.protocolInfo.data_gateway
        );

        this.litNodeClient = new LitNodeClient({
            litNetwork: SELECTED_LIT_NETWORK,
            debug: false,
        });

        await this.litNodeClient.connect();
        const provider5 = new providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE);
        this.ethersWallet = new Wallet5(epk, provider5);

        await this.createSession();
        console.log("ready")
    }

    async createSession() {
       
        const litContracts = new LitContracts({
            signer: this.ethersWallet,
            network: SELECTED_LIT_NETWORK,
        });
        await litContracts.connect();

        const capacityTokenId = (
        await litContracts.mintCapacityCreditsNFT({
            requestsPerKilosecond: 10,
            daysUntilUTCMidnightExpiration: 1,
        })
        ).capacityTokenIdStr;

        console.log("Capacity token ID:", capacityTokenId);
        
        const { capacityDelegationAuthSig } =
            await this.litNodeClient.createCapacityDelegationAuthSig({
            dAppOwnerWallet: this.ethersWallet,
            capacityTokenId,
            delegateeAddresses: [this.ethersWallet.address],
            uses: "1",
            });

        this.sessionSignatures = await this.litNodeClient.getSessionSigs({
            chain: "yellowstone",
            capabilityAuthSigs: [capacityDelegationAuthSig],
            expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
            resourceAbilityRequests: [
                {
                    resource: new LitPKPResource("*"),
                    ability: LIT_ABILITY.PKPSigning,
                },
                {
                    resource: new LitActionResource("*"),
                    ability: LIT_ABILITY.LitActionExecution,
                },
            ],
            authNeededCallback: async (params: any) => {

                const { resourceAbilityRequests, expiration, uri } = params;
        
                // Guard against undefined values
                if (!uri || !expiration || !resourceAbilityRequests) {
                throw new Error("Missing required parameters for SIWE message");
                }

                const toSign = await createSiweMessageWithResources({
                    uri: uri,
                    expiration: expiration,
                    resources: resourceAbilityRequests,
                    walletAddress: this.ethersWallet.address,
                    nonce: await this.litNodeClient.getLatestBlockhash()
                });

                return await generateAuthSig({
                    signer: this.ethersWallet,
                    toSign,
                });
            },
        });

    }

    session() {
        return this.sessionSignatures;
    }

    async runAction(authorSafeAddress: string, publication: string, STREAM_IDS: string[], configCid: string) {

        return await this.litNodeClient.executeJs({
            sessionSigs: this.sessionSignatures,
            ipfsId: this.protocolInfo.lit_action_main,
            jsParams: {
                authorSafeAddress,
                publication,
                stream_ids: STREAM_IDS,
                config_cid: configCid,
                publish: true,
                dev: true,
            },
        });
    }

    async renewConfig(publication: string) {

        return await this.builder.buildConfig(publication,"");
    }
}