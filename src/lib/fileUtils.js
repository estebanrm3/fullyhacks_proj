export async function fileToGeminiParts(file) {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (isPDF) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    return [{ inlineData: { data: base64, mimeType: 'application/pdf' } }]
  }

  // DOCX: extract plain text via mammoth
  try {
    const { default: mammoth } = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer })
    return [{ text: value || `Document: ${file.name}` }]
  } catch {
    return [{ text: `Document: ${file.name}` }]
  }
}
