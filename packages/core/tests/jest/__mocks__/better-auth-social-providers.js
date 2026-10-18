/**
 * Mock for better-auth/social-providers (an ESM re-export Jest can't parse).
 * Only the id list lib/auth/social-providers.ts reads; tests/node/social-providers.test.ts
 * checks it against the installed Better Auth.
 */

module.exports = {
  socialProviderList: ["apple","atlassian","cloudflare","cognito","discord","facebook","figma","github","microsoft","google","huggingface","slack","spotify","twitch","twitter","dropbox","kick","linear","linkedin","gitlab","tiktok","reddit","roblox","salesforce","vk","zoom","notion","kakao","naver","line","paybin","paypal","polar","railway","vercel","wechat"],
}
