const Shopify = require('shopify-api-node');

module.exports = async (req, res) => {
  try {
    // Parâmetros da query
    const start = parseInt(req.query.start) || 1;
    const end = parseInt(req.query.end) || 1000;
    const limit = Math.min(parseInt(req.query.limit) || 250, 250);
    
    console.log(`Iniciando exportação parcial de produtos - Intervalo: ${start} a ${end}`);
    
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
    
    // Buscar produtos no intervalo especificado
    let allProducts = [];
    let currentProduct = 0;
    let currentPage = Math.ceil(start / limit);
    let params = { limit, page: currentPage };
    
    while (currentProduct < end) {
      console.log(`Buscando página ${currentPage}...`);
      const products = await shopify.product.list(params);
      
      if (products.length === 0) {
        console.log('Não há mais produtos disponíveis');
        break;
      }
      
      // Se estivermos na primeira página, podemos precisar pular alguns produtos iniciais
      if (currentPage === Math.ceil(start / limit)) {
        const startIndex = (start - 1) % limit;
        const relevantProducts = products.slice(startIndex);
        allProducts = allProducts.concat(relevantProducts);
        currentProduct += relevantProducts.length;
      } else {
        allProducts = allProducts.concat(products);
        currentProduct += products.length;
      }
      
      console.log(`Progresso: ${Math.min(currentProduct, end - start + 1)}/${end - start + 1} produtos`);
      
      // Parar se chegarmos ao fim ou ao limite superior
      if (products.length < limit || currentProduct >= end) {
        break;
      }
      
      // Próxima página
      currentPage++;
      params.page = currentPage;
    }
    
    // Garantir que não temos mais produtos que o solicitado no final
    if (allProducts.length > (end - start + 1)) {
      allProducts = allProducts.slice(0, end - start + 1);
    }
    
    console.log(`Obtidos ${allProducts.length} produtos no intervalo solicitado`);
    
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
    
    // Criar CSV
    let csvContent = 'ID,Variant_ID,SKU,Nome_do_Produto,Variação,Quantidade,Preço\n';
    
    csvData.forEach(item => {
      const safeProduct = item.product_name ? item.product_name.replace(/"/g, '""') : '';
      const safeVariant = item.variant_name ? item.variant_name.replace(/"/g, '""') : '';
      const safeSku = item.sku ? item.sku.replace(/"/g, '""') : '';
      
      csvContent += `${item.id},${item.variant_id},"${safeSku}","${safeProduct}","${safeVariant}",${item.inventory_quantity},${item.price}\n`;
    });
    
    // Enviar resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=produtos-shopify-${start}-${end}.csv`);
    res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Erro na exportação:', error);
    res.status(500).json({ error: 'Falha ao exportar produtos', message: error.message });
  }
};
