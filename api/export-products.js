const Shopify = require('shopify-api-node');

module.exports = async (req, res) => {
  try {
    // Verificar se as credenciais estão configuradas
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_PASSWORD) {
      return res.status(500).json({ 
        error: 'Configuração incompleta', 
        message: 'Credenciais do Shopify não configuradas' 
      });
    }
    
    // Configurar Shopify
    const shopify = new Shopify({
      shopName: process.env.SHOPIFY_SHOP_NAME,
      apiKey: process.env.SHOPIFY_API_KEY,
      password: process.env.SHOPIFY_PASSWORD,
      apiVersion: '2023-10'
    });
    
    // Buscar todos os produtos com paginação
    let products = [];
    let params = { limit: 250 }; // máximo permitido pela API do Shopify
    let hasNextPage = true;
    
    while (hasNextPage) {
      const productBatch = await shopify.product.list(params);
      products = products.concat(productBatch);
      
      // Verifica se há mais páginas
      if (productBatch.length < 250) {
        hasNextPage = false;
      } else {
        // Configura para próxima página
        if (productBatch.nextPageParameters) {
          params = productBatch.nextPageParameters;
        } else {
          hasNextPage = false;
        }
      }
    }
    
    // Processar produtos para CSV
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
      }
    }
    
    // Criar CSV como string
    let csvContent = 'SKU,Nome do Produto,Variação,Quantidade em Estoque\n';
    
    csvData.forEach(item => {
      csvContent += `${item.sku},"${item.product_name}","${item.variant_name}",${item.inventory_quantity}\n`;
    });
    
    // Configurar a resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=shopify-products.csv');
    res.status(200).send(csvContent);
    
  } catch (error) {
    res.status(500).json({ error: 'Falha ao exportar produtos', message: error.message });
  }
};
