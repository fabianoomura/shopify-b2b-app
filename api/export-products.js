const Shopify = require('shopify-api-node');

module.exports = async (req, res) => {
  try {
    console.log('Iniciando exportação de produtos');
    
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
    
    console.log('Obtendo contagem total de produtos');
    const totalCount = await shopify.product.count();
    console.log(`Total de ${totalCount} produtos na loja`);
    
    // Buscar produtos de forma eficiente
    console.log('Buscando produtos...');
    let allProducts = [];
    let pageInfo = null; // Para usar com o cursor de paginação
    
    // Usar o método correto de paginação baseada em cursor
    while (true) {
      // Configurar parâmetros para esta página
      const params = {
        limit: 250 // Máximo permitido pela API
      };
      
      // Se tivermos um cursor da página anterior, usá-lo
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      
      // Fazer a chamada da API
      const response = await shopify.product.list(params);
      console.log(`Obtidos ${response.length} produtos neste lote`);
      
      // Adicionar produtos ao array master
      allProducts = allProducts.concat(response);
      console.log(`Total acumulado: ${allProducts.length}/${totalCount} produtos`);
      
      // Verificar se há mais páginas
      const link = shopify.callLimits.calls.rest.made[0]?.header?.link;
      if (!link || !link.includes('rel="next"')) {
        console.log('Não há mais páginas para buscar');
        break;
      }
      
      // Extrair o cursor para a próxima página
      const nextLink = link.split(',').find(str => str.includes('rel="next"'));
      if (!nextLink) break;
      
      const match = nextLink.match(/page_info=([^>&]*)/);
      if (!match) break;
      
      pageInfo = match[1];
      console.log(`Cursor para próxima página obtido: ${pageInfo.substring(0, 10)}...`);
    }
    
    console.log(`Processamento completo: ${allProducts.length}/${totalCount} produtos obtidos`);
    
    // Processar produtos para CSV
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
    
    console.log(`Processadas ${csvData.length} variantes para o CSV`);
    
    // Criar CSV
    let csvContent = 'ID,Variant_ID,SKU,Nome_do_Produto,Variação,Quantidade,Preço\n';
    
    csvData.forEach(item => {
      const escapedName = item.product_name.replace(/"/g, '""');
      const escapedVariant = item.variant_name.replace(/"/g, '""');
      const escapedSku = item.sku.replace(/"/g, '""');
      
      csvContent += `${item.id},${item.variant_id},"${escapedSku}","${escapedName}","${escapedVariant}",${item.inventory_quantity},${item.price}\n`;
    });
    
    // Enviar resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=todos-produtos-shopify.csv');
    res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Erro na exportação:', error);
    res.status(500).json({ error: 'Falha ao exportar produtos', message: error.message });
  }
};
