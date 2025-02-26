const express = require('express');
const Shopify = require('shopify-api-node');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
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

// Rota para exportar produtos como CSV
app.get('/export-products', async (req, res) => {
  try {
    // Coletar todos os produtos
    let products = [];
    let params = { limit: 250 };
    let hasNextPage = true;
    
    while (hasNextPage) {
      const productBatch = await shopify.product.list(params);
      products = products.concat(productBatch);
      
      if (productBatch.length < 250) {
        hasNextPage = false;
      } else {
        params.page_info = productBatch.nextPageParameters?.page_info;
      }
    }
    
    // Processar produtos e variantes para formato CSV
    let csvData = [];
    
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
    
    // Configurar a resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=shopify-products.csv');
    
    // Criar CSV diretamente na resposta
    const csvWriter = createCsvWriter({
      path: null, // nenhum arquivo no disco, só na memória
      header: [
        { id: 'sku', title: 'SKU' },
        { id: 'product_name', title: 'Nome do Produto' },
        { id: 'variant_name', title: 'Variação' },
        { id: 'inventory_quantity', title: 'Quantidade em Estoque' }
      ]
    });
    
    // Gerar CSV e enviar na resposta
    const csvString = await csvWriter.writeRecords(csvData).then(() => csvWriter.stringifier.getHeaderString() + csvWriter.stringifier.getRecordsString());
    res.send(csvString);
    
  } catch (error) {
    console.error('Erro ao exportar produtos:', error);
    res.status(500).json({ error: 'Falha ao exportar produtos', details: error.message });
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
