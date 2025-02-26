Shopify B2B App - Exportação de Produtos
API para exportação de produtos Shopify em formato CSV.

Funcionalidades
Exportação de produtos do Shopify em formato CSV
Inclui SKU, nome do produto, variações e quantidade em estoque
Endpoints
/: Verifica se a API está funcionando
/export-products: Exporta os produtos em formato CSV
/diagnostico: Verifica a configuração e a conexão com a API Shopify
Configuração
A aplicação requer as seguintes variáveis de ambiente na Vercel:

SHOPIFY_SHOP_NAME: Nome da sua loja Shopify (sem o .myshopify.com)
SHOPIFY_API_KEY: Chave de API do Shopify
SHOPIFY_PASSWORD: Senha da API ou token de acesso
Tecnologias
Node.js
Express
Shopify API
Vercel Serverless Functions
