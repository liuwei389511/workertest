/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { createSchema, createYoga } from 'graphql-yoga';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

const yoga = createYoga<Env>({
	schema: createSchema({
		typeDefs: /* GraphQL */ `
			type PokemonSprites {
				front_default: String!
				front_shiny: String!
				front_female: String!
				front_shiny_female: String!
				back_default: String!
				back_shiny: String!
				back_female: String!
				back_shiny_female: String!
			}
			type Pokemon {
				id: ID!
				name: String!
				height: Int!
				weight: Int!
				sprites: PokemonSprites!
			}
			type Query {
				pokemon(id: ID!): Pokemon
				askDeepseek(prompt: String!): String
			}
		`,
		resolvers: {
			Query: {
				pokemon: async (_parent, { id }) => {
					const result = await fetch(new Request(`https://pokeapi.co/api/v2/pokemon/${id}`), {
						cf: {
							// Always cache this fetch regardless of content type
							// for a max of 1 min before revalidating the resource
							cacheTtl: 50,
							cacheEverything: true,
						},
					});
					return await result.json();
				},
				askDeepseek: async (_parent, { prompt }) => {
					const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
					const deepseekApiKey = 'sk-e880da07a71d41fd99f563286d94c3ed';
					try {
						const response = await fetch(apiUrl, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${deepseekApiKey}`,
							},
							body: JSON.stringify({
								model: 'deepseek-chat',
								messages: [{ role: 'user', content: prompt }],
							}),
						});
						if (!response.ok) {
							const errorText = await response.text();
							throw new Error(`DeepSeek API 错误: ${response.status} ${errorText}`);
						}
						const result: any = await response.json();

						// 检查账户余额
						if (result.error && result.error.message === 'Insufficient Balance') {
							return '账户余额不足，请充值后再试。';
						}
						// 检查请求错误
						if (result.error) {
							return result.error.message;
						}
						// 返回 DeepSeek 的回答
						if (result.choices && result.choices[0]) {
							return result.choices[0].message.content.trim();
						}
						// 没找到答案
						return '对不起，没找到答案';
					} catch (error: any) {
						throw new Error(`DeepSeek API error: ${error.message}`);
					}
				},
			},
		},
	}),
	graphiql: {
		defaultQuery: /* GraphQL */ `
			query samplePokeAPIquery {
				pokemon: pokemon(id: 1) {
					id
					name
					height
					weight
					sprites {
						front_shiny
						back_shiny
					}
				}
			}
			query sampleDeepseekQuery($prompt: String!) {
				deepseekResponse: askDeepseek(prompt: $prompt)
			}
		`,
	},
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return yoga.fetch(request, env);
	},
};
