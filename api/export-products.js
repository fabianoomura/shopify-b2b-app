const Shopify = require('shopify-api-node');

module.exports = async (req, res) => {
  try {
    console.log('Iniciando exportação completa dos produtos');
    
    // Verificar credenciais
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
    
    console.log('Conectado à API Shopify, buscando produtos...');
    
    // Buscar todos os produtos com paginação adequada
    let allProducts = [];
    let params = { limit: 250 }; // 250 é o máximo permitido pela API Shopify
    let hasNextPage = true;
    let pageCount = 0;
    
    // Usar paginação para buscar todos os produtos
    while (hasNextPage) {
      pageCount++;
      console.log(`Buscando página ${pageCount} de produtos...`);
      
      const productBatch = await shopify.product.list(params);
      allProducts = allProducts.concat(productBatch);
      console.log(`Recebidos ${productBatch.length} produtos. Total acumulado: ${allProducts.length}`);
      
      // Verificar se há mais páginas
      if (productBatch.length < 250) {
        hasNextPage = false;
        console.log('Última página alcançada.');
      } else {
        // Configurar para buscar a próxima página
        params.page_info = productBatch.nextPageParameters?.page_info;
        if (!params.page_info) {
          params.page = (params.page || 1) + 1;
        }
      }
    }
    
    console.log(`Total de ${allProducts.length} produtos recuperados.`);
    
    // Processar produtos e variantes para CSV
    let csvData = [];
    
    for (const product of allProducts) {
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          csvData.push({
            id: product.id,
            variant_id: variant.id,
            sku: variant.sku || '',
            product_name: product.title,
            variant_name: variant.title !== 'Default Title' ? variant.title : '',
            inventory_quantity: variant.inventory_quantity || 0,
            price: variant.price || '0.00'
          });
        }
      }
    }
    
    console.log(`Processadas ${csvData.length} linhas de produtos/variantes para o CSV.`);
    
    // Criar CSV como string
    let csvContent = 'ID,Variant_ID,SKU,Nome_do_Produto,Variação,Quantidade,Preço\n';
    
    csvData.forEach(item => {
      // Escapar aspas dentro de strings e envolver campos de texto em aspas duplas
      const escapedName = item.product_name.replace(/"/g, '""');
      const escapedVariant = item.variant_name.replace(/"/g, '""');
      const escapedSku = item.sku.replace(/"/g, '""');
      
      csvContent += `${item.id},${item.variant_id},"${escapedSku}","${escapedName}","${escapedVariant}",${item.inventory_quantity},${item.price}\n`;
    });
    
    // Configurar a resposta para download automático
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=todos-produtos-shopify.csv');
    
    console.log('Enviando CSV com todos os produtos...');
    res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Erro durante a exportação:', error);
    res.status(500).json({ 
      error: 'Falha ao exportar produtos', 
      message: error.message,
      stack: error.stack 
    });
  }
};
