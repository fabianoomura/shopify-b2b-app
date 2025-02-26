const express = require('express');
const Shopify = require('shopify-api-node');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuração do Shopify
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_PASSWORD,
  apiVersion: '2023-10'
});

// Rota para exportar produtos como CSV com melhor tratamento de erros
app.get('/export-products', async (req, res) => {
  try {
    // Log para diagnóstico
    console.log('Iniciando exportação de produtos');
    
    // Verificar se as credenciais estão configuradas
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_PASSWORD) {
      return res.status(500).json({ 
        error: 'Configuração incompleta', 
        message: 'Credenciais do Shopify não configuradas adequadamente nas variáveis de ambiente.' 
      });
    }
    
    // Log das credenciais (apenas parcial para segurança)
    console.log(`Usando loja: ${process.env.SHOPIFY_SHOP_NAME}`);
    console.log(`API Key configurada: ${process.env.SHOPIFY_API_KEY ? 'Sim' : 'Não'}`);
    
    // Coletar todos os produtos
    console.log('Buscando produtos da API Shopify...');
    let products = [];
    let params = { limit: 50 }; // Reduzido para evitar timeout
    
    const productBatch = await shopify.product.list(params);
    products = products.concat(productBatch);
    console.log(`${products.length} produtos encontrados`);
    
    // Processar produtos e variantes para formato CSV
    let csvData = [];
    console.log('Processando produtos para CSV...');
    
    for (const product of products) {
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          csvData.push({
            sku: variant.sku || '',
            product_name: product.title,
            variant_name: variant.title !== 'Default Title' ? variant.title : '',
            inventory_quantity: variant.inventory_quantity || 0
          });
        }
      } else {
        csvData.push({
          sku: '',
          product_name: product.title,
          variant_name: '',
          inventory_quantity: 0
        });
      }
    }
    
    console.log(`${csvData.length} linhas de dados processadas`);
    
    // Criar CSV como string
    console.log('Gerando string CSV...');
    let csvContent = 'SKU,Nome do Produto,Variação,Quantidade em Estoque\n';
    
    csvData.forEach(item => {
      csvContent += `${item.sku},"${item.product_name}","${item.variant_name}",${item.inventory_quantity}\n`;
    });
    
    // Configurar a resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=shopify-products.csv');
    res.send(csvContent);
    
  } catch (error) {
    console.error('Erro ao exportar produtos:', error);
    res.status(500).json({ 
      error: 'Falha ao exportar produtos', 
      message: error.message,
      stack: error.stack 
    });
  }
});

// Rota de diagnóstico
app.get('/diagnostico', async (req, res) => {
  try {
    const result = {
      ambiente: {
        shopName: process.env.SHOPIFY_SHOP_NAME ? 'Configurado' : 'Não configurado',
        apiKey: process.env.SHOPIFY_API_KEY ? 'Configurado' : 'Não configurado',
        password: process.env.SHOPIFY_PASSWORD ? 'Configurado' : 'Não configurado'
      }
    };
    
    // Tentar conexão com Shopify
    try {
      const shop = await shopify.shop.get();
      result.shopify = {
        conectado: true,
        nome: shop.name,
        email: shop.email,
        plano: shop.plan_name
      };
    } catch (shopifyError) {
      result.shopify = {
        conectado: false,
        erro: shopifyError.message
      };
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Rota raiz para verificação
app.get('/', (req, res) => {
  res.send('API de exportação de produtos Shopify funcionando!');
});

// Para desenvolvimento local
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

// Para serverless na Vercel
module.exports = app;
