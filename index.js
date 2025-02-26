const express = require('express');
const app = express();

// Rota raiz
app.get('/', (req, res) => {
  res.send('API de exportação de produtos Shopify funcionando!');
});

// Rota de diagnóstico simplificada
app.get('/diagnostico', (req, res) => {
  try {
    const info = {
      status: 'online',
      ambiente: {
        node_version: process.version,
        env_vars: {
          shopify_shop: process.env.SHOPIFY_SHOP_NAME ? "configurado" : "não configurado",
          shopify_key: process.env.SHOPIFY_API_KEY ? "configurado" : "não configurado",
          shopify_password: process.env.SHOPIFY_PASSWORD ? "configurado" : "não configurado"
        }
      }
    };
    
    res.json(info);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Versão simplificada da exportação
app.get('/export-products', (req, res) => {
  try {
    // Respostas simples para teste
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=test.csv');
    res.send('SKU,Nome,Variação,Estoque\n123,Produto Teste,Padrão,10');
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Para desenvolvimento local
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
}

// Para serverless
module.exports = app;
