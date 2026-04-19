import { handleLiveTokenHttp } from './_gemini.js'

export default async function handler(req, res) {
  return handleLiveTokenHttp(req, res)
}
