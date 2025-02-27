const Shopify = require('shopify-api-node');

module.exports = async (req, res) => {
  try {
    // Objeto para armazenar resultados do diagnóstico
    const diagnostico = {
      timestamp: new Date().toISOString(),
      ambiente: {
        node_version: process.version,
        env_vars: {
          shopify_shop: process.env.SHOPIFY_SHOP_NAME ? "configurado" : "não configurado",
          shopify_key: process.env.SHOPIFY_API_KEY ? "configurado" : "não configurado",
          shopify_password: process.env.SHOPIFY_PASSWORD ? "configurado" : "não configurado"
        }
      },
      etapas: [],
      totalProdutos: 0,
      totalVariantes: 0,
      paginas: [],
      erro: null,
      tempo: {
        inicio: Date.now(),
        fim: null,
        duracao: null
      }
    };
    
    // Adicionar etapa ao diagnóstico
    function adicionarEtapa(mensagem) {
      const agora = Date.now();
      diagnostico.etapas.push({
        mensagem,
        timestamp: new Date().toISOString(),
        tempo_desde_inicio: `${(agora - diagnostico.tempo.inicio) / 1000} segundos`
      });
      
      // Também envia para console para logs da Vercel
      console.log(`[${new Date().toISOString()}] ${mensagem}`);
    }
    
    adicionarEtapa("Iniciando diagnóstico de exportação");
    
    // Verificar credenciais
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_PASSWORD) {
      adicionarEtapa("ERRO: Credenciais do Shopify não configuradas");
      diagnostico.erro = "Credenciais do Shopify não configuradas";
      
      diagnostico.tempo.fim = Date.now();
      diagnostico.tempo.duracao = `${(diagnostico.tempo.fim - diagnostico.tempo.inicio) / 1000} segundos`;
      
      return res.status(500).json(diagnostico);
    }
    
    // Configurar Shopify
    adicionarEtapa("Configurando conexão com Shopify");
    const shopify = new Shopify({
      shopName: process.env.SHOPIFY_SHOP_NAME,
      apiKey: process.env.SHOPIFY_API_KEY,
      password: process.env.SHOPIFY_PASSWORD,
      apiVersion: '2023-10'
    });
    
    // Tentar obter informações da loja para verificar conexão
    try {
      adicionarEtapa("Verificando conexão com API Shopify");
      const shopInfo = await shopify.shop.get();
      diagnostico.infoLoja = {
        nome: shopInfo.name,
        email: shopInfo.email,
        dominio: shopInfo.domain,
        plano: shopInfo.plan_name
      };
      adicionarEtapa(`Conexão verificada com sucesso. Loja: ${shopInfo.name}`);
    } catch (error) {
      adicionarEtapa(`ERRO ao verificar conexão: ${error.message}`);
      diagnostico.erro = `Falha na autenticação: ${error.message}`;
      
      diagnostico.tempo.fim = Date.now();
      diagnostico.tempo.duracao = `${(diagnostico.tempo.fim - diagnostico.tempo.inicio) / 1000} segundos`;
      
      return res.status(500).json(diagnostico);
    }
    
    // Obter contagem total de produtos
    try {
      adicionarEtapa("Obtendo contagem total de produtos");
      const productCount = await shopify.product.count();
      diagnostico.totalProdutos = productCount;
      adicionarEtapa(`Total de produtos na loja: ${productCount}`);
    } catch (error) {
      adicionarEtapa(`ERRO ao contar produtos: ${error.message}`);
      diagnostico.erro = `Falha ao contar produtos: ${error.message}`;
    }
    
    // Buscar produtos página por página
    adicionarEtapa("Iniciando busca paginada de produtos");
    
    let allProducts = [];
    let params = { limit: 50 }; // Menor para evitar timeout
    let hasNextPage = true;
    let pageCount = 0;
    
    while (hasNextPage && pageCount < 10) { // Limitar a 10 páginas para diagnóstico
      pageCount++;
      adicionarEtapa(`Buscando página ${pageCount} de produtos...`);
      
      try {
        const startPageTime = Date.now();
        const productBatch = await shopify.product.list(params);
        const pageDuration = Date.now() - startPageTime;
        
        allProducts = allProducts.concat(productBatch);
        
        // Contar variantes nesta página
        let variantCount = 0;
        productBatch.forEach(product => {
          if (product.variants) {
            variantCount += product.variants.length;
          }
        });
        
        const infoPage = {
          numero_pagina: pageCount,
          produtos_obtidos: productBatch.length,
          variantes_obtidas: variantCount,
          tempo_busca: `${pageDuration / 1000} segundos`,
          primeiro_produto: productBatch.length > 0 ? {
            id: productBatch[0].id,
            title: productBatch[0].title
          } : null,
          ultimo_produto: productBatch.length > 0 ? {
            id: productBatch[productBatch.length - 1].id,
            title: productBatch[productBatch.length - 1].title
          } : null,
          parametros_proxima: JSON.stringify(productBatch.nextPageParameters || {})
        };
        
        diagnostico.paginas.push(infoPage);
        
        adicionarEtapa(`Página ${pageCount}: Obtidos ${productBatch.length} produtos (${variantCount} variantes) em ${pageDuration / 1000} segundos`);
        
        // Verificar se há mais páginas
        if (productBatch.length < 50) {
          hasNextPage = false;
          adicionarEtapa("Última página alcançada - produtos insuficientes para próxima página");
        } else {
          // Configurar para próxima página
          if (productBatch.nextPageParameters) {
            params = productBatch.nextPageParameters;
            adicionarEtapa(`Configurando parâmetros para próxima página: ${JSON.stringify(params)}`);
          } else {
            params.page = (params.page || 1) + 1;
            adicionarEtapa(`Próxima página definida como: ${params.page}`);
          }
        }
      } catch (error) {
        adicionarEtapa(`ERRO na página ${pageCount}: ${error.message}`);
        diagnostico.erro = `Falha ao buscar página ${pageCount}: ${error.message}`;
        hasNextPage = false;
      }
      
      // Verificar tempo decorrido para evitar timeout
      const elapsedTime = (Date.now() - diagnostico.tempo.inicio) / 1000;
      if (elapsedTime > 45) { // Limitando a 45 segundos para evitar timeout de 60s
        adicionarEtapa(`AVISO: Atingido limite de tempo seguro (${elapsedTime} segundos), interrompendo busca para evitar timeout`);
        diagnostico.avisos = diagnostico.avisos || [];
        diagnostico.avisos.push("Busca interrompida para evitar timeout da função serverless");
        break;
      }
    }
    
    // Resumo final
    diagnostico.totalProdutosObtidos = allProducts.length;
    
    // Contar variantes totais
    let totalVariants = 0;
    allProducts.forEach(product => {
      if (product.variants) {
        totalVariants += product.variants.length;
      }
    });
    diagnostico.totalVariantes = totalVariants;
    
    // Finalizar diagnóstico
    diagnostico.tempo.fim = Date.now();
    diagnostico.tempo.duracao = `${(diagnostico.tempo.fim - diagnostico.tempo.inicio) / 1000} segundos`;
    
    adicionarEtapa(`Diagnóstico concluído. Obtidos ${allProducts.length} produtos (${totalVariants} variantes) em ${diagnostico.tempo.duracao}`);
    
    // Enviar diagnóstico como JSON
    res.status(200).json(diagnostico);
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Falha ao executar diagnóstico', 
      message: error.message,
      stack: error.stack 
    });
  }
};
