// api/save.js — Vercel Serverless Function
// Recebe o HTML editado, autentica com senha e salva via GitHub API

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, html, uploadedFiles } = req.body;

    // Verificar senha
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'v-poffo';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'vini-poffo-masterclass';

    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GitHub token não configurado' });
    }

    const headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // Primeiro, fazer upload de novas fotos se houver
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const { name, content } = file; // content é base64
        const filePath = `fotos/${name}`;

        // Verificar se arquivo já existe para pegar o SHA
        let sha = null;
        try {
          const checkRes = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
            { headers }
          );
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            sha = checkData.sha;
          }
        } catch (e) {}

        const body = {
          message: `admin: upload foto ${name}`,
          content: content,
          ...(sha ? { sha } : {}),
        };

        await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
          { method: 'PUT', headers, body: JSON.stringify(body) }
        );
      }
    }

    // Buscar SHA atual do index.html
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/index.html`,
      { headers }
    );

    if (!getRes.ok) {
      return res.status(500).json({ error: 'Erro ao buscar index.html do GitHub' });
    }

    const getData = await getRes.json();
    const currentSha = getData.sha;

    // Codificar HTML em base64
    const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64');

    // Salvar novo index.html
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/index.html`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'admin: atualização via painel visual',
          content: htmlBase64,
          sha: currentSha,
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(500).json({ error: `Erro ao salvar: ${err}` });
    }

    return res.status(200).json({ success: true, message: 'Salvo! O site será atualizado em ~30 segundos.' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
