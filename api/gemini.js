import { handleGeminiHttp } from './_gemini.js'

export default async function handler(req, res) {
  return handleGeminiHttp(req, res)
}
