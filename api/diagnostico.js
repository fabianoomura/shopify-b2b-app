module.exports = (req, res) => {
  try {
    const info = {
      status: 'online',
      timestamp: new Date().toISOString(),
      ambiente: {
        node_version: process.version,
        env_vars: {
          shopify_shop: process.env.SHOPIFY_SHOP_NAME ? "configurado" : "não configurado",
          shopify_key: process.env.SHOPIFY_API_KEY ? "configurado" : "não configurado",
          shopify_password: process.env.SHOPIFY_PASSWORD ? "configurado" : "não configurado"
        }
      }
    };
    
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
};
