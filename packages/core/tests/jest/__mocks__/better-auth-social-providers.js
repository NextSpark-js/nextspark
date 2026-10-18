/**
 * Mock for better-auth/social-providers (an ESM re-export Jest can't parse).
 * The id list and the provider factories lib/auth/social-providers.ts uses;
 * tests/node/social-providers.test.ts checks the list against the installed
 * Better Auth, and that its cognito, like this one, refuses missing options.
 */

const socialProviderList = ["apple","atlassian","cloudflare","cognito","discord","facebook","figma","github","microsoft","google","huggingface","slack","spotify","twitch","twitter","dropbox","kick","linear","linkedin","gitlab","tiktok","reddit","roblox","salesforce","vk","zoom","notion","kakao","naver","line","paybin","paypal","polar","railway","vercel","wechat"]

const socialProviders = Object.fromEntries(socialProviderList.map((id) => [id, (options) => ({ id, options })]))
socialProviders.cognito = (options) => {
  if (!options.domain || !options.region || !options.userPoolId) throw new Error('DOMAIN_AND_REGION_REQUIRED')
  return { id: 'cognito', options }
}

module.exports = { socialProviderList, socialProviders }
