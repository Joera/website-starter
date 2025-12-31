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

    constructor() {}

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

        await this.createSessions();
        console.log("ready")
    }

    async createSessions() {
       
        const litContracts = new LitContracts({
            signer: this.ethersWallet,
            network: SELECTED_LIT_NETWORK,
        });
        await litContracts.connect();

        const capacityTokenId = (
        await litContracts.mintCapacityCreditsNFT({
            requestsPerKilosecond: 9999,
            daysUntilUTCMidnightExpiration: 1,
        })
        ).capacityTokenIdStr;

        console.log("Capacity token ID:", capacityTokenId);
        
        const { capacityDelegationAuthSig } =
            await this.litNodeClient.createCapacityDelegationAuthSig({
            dAppOwnerWallet: this.ethersWallet,
            capacityTokenId,
            delegateeAddresses: [this.ethersWallet.address],
            uses: "99",
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

    // async runActionSimple(authorSafeAddress: string, publication: string, STREAM_IDS: string[], configCid: string) {

    //     const job = {};
    //     const dev = true;
    //     const debug = false;
    //     const index = 10;

    //     this.protocolInfo = await getProtocolInfo();

    //     const jsParams = { authorSafeAddress, config_cid: configCid, publication, job, index }

    //     return await this.litNodeClient.executeJs({
    //         sessionSigs: this.sessionSignatures,
    //         ipfsId: this.protocolInfo.lit_action_single,
    //         jsParams,
    //     })
    // }

    async runAction(authorSafeAddress: string, publication: string, STREAM_IDS: string[], configCid: string) {

        const dev = true;
        const debug = false;

        this.protocolInfo = await getProtocolInfo();

        console.log(this.protocolInfo);

        let prep: any = await this.litNodeClient.executeJs({
            sessionSigs: this.sessionSignatures,
            ipfsId: this.protocolInfo.lit_action_prep,
            jsParams: {
                authorSafeAddress,
                publication,
                config_cid: configCid,
                stream_ids: STREAM_IDS,
                dev 
            },
        });

        console.log("prepped", prep)

       
        let jobs = JSON.parse(prep.response).jobs;    
      

        const results = await Promise.all(
            jobs.map((job: any, index: number) =>  {
                const jsParams = { authorSafeAddress, config_cid: configCid, publication, job, debug, dev }
                return this.executeJobWithTimeout(jsParams, index, 40000)
            })
        );

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        console.log(`Completed: ${successful.length}/${jobs.length}`);
        failed.forEach(f => console.error(`Job ${f.index} failed:`, f.error.message, f.error))

        console.log("S", successful)

        const renderedJobs = successful.map( r => 
            JSON.parse(r.result.response).job
        ).filter( j => j.path != undefined)

        // html here has the collections
        console.log(renderedJobs);

        return await this.litNodeClient.executeJs({
            sessionSigs: this.sessionSignatures,
            ipfsId: this.protocolInfo.lit_action_cbor,
            jsParams: {
                authorSafeAddress,
                publication,
                jobs: renderedJobs,
                dev 
            },
        });
    }

    async renewConfig(publication: string) {

        return await this.builder.buildConfig(publication,"");
    }

    async executeJobWithTimeout (jsParams: any, index: number, timeoutMs = 30000) {

        await new Promise(resolve => setTimeout(resolve, index * 1000));

        let capturedLogs: string[] = [];
            
        try {
            const result = await Promise.race([
                this.litNodeClient.executeJs({
                    sessionSigs: this.sessionSignatures,
                    ipfsId: this.protocolInfo.lit_action_single,
                    jsParams,
                }),
                
                new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
                )
            ]);

            // console.log(result)
            
            return { success: true, index, result };
            
            } catch (error) {


            console.log(error)
            // Try to extract any logs from the error object
            const logs = (error as any)?.logs || 
                        (error as any)?.response?.logs || 
                        (error as any)?.details?.logs || 
                        capturedLogs;
            
            return { 
                success: false, 
                index, 
                error,
                logs // Preserve whatever logs we got
            };
        }
    };
}