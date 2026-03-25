# Guia de Teste: Conexão com MCP Oficial da Figma

Este guia explica como testar a viabilidade técnica de criar um MCP Bridge para conectar o AI Cockpit Reasoning ao MCP oficial da Figma.

---

## 📋 Pré-requisitos

1. **Node.js** instalado (versão 18 ou superior)
2. **Figma Access Token** (Personal Access Token)
3. **Dependências do projeto** instaladas

---

## 🔧 Configuração

### Passo 1: Instalar Dependências

Se ainda não instalou as dependências do projeto:

```bash
npm install
# ou
pnpm install
```

### Passo 2: Configurar Token da Figma

Você precisa de um Personal Access Token da Figma. Para criar um:

1. Acesse: https://www.figma.com/developers/api#access-tokens
2. Clique em "Get personal access token"
3. Dê um nome ao token (ex: "MCP Bridge Test")
4. Copie o token gerado

### Passo 3: Configurar Variável de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```bash
# .env
FIGMA_ACCESS_TOKEN=figd_seu_token_aqui
```

**⚠️ IMPORTANTE:** Nunca commite o arquivo `.env` com seu token!

---

## 🧪 Executando o Teste

### Opção 1: Usando tsx (Recomendado)

```bash
npx tsx tests/mcp-connection-test.ts
```

### Opção 2: Compilar e Executar

```bash
npm run build
node dist/tests/mcp-connection-test.js
```

---

## 📊 O Que o Teste Faz

O script executa 4 testes sequenciais:

### 1️⃣ Teste de Conexão SSE
- **Objetivo:** Verificar se consegue criar um transport SSE para `https://mcp.figma.com/mcp`
- **Sucesso:** Transport criado sem erros
- **Falha:** Erro de rede, URL inválida, ou servidor inacessível

### 2️⃣ Teste de Autenticação
- **Objetivo:** Verificar se o token da Figma é válido e se consegue autenticar
- **Sucesso:** Cliente MCP conectado com sucesso
- **Falha:** Token inválido, expirado, ou sem permissões

### 3️⃣ Teste de Listagem de Tools
- **Objetivo:** Listar todas as tools disponíveis no MCP oficial
- **Sucesso:** Lista de 13 tools retornada
- **Falha:** Erro de comunicação ou formato de resposta inválido

### 4️⃣ Teste de Chamada de Tool
- **Objetivo:** Executar a tool `whoami` para validar o fluxo completo
- **Sucesso:** Tool executada e resposta recebida
- **Falha:** Erro na execução ou timeout

---

## ✅ Resultados Esperados

### Cenário de Sucesso Total

```
🔬 Iniciando testes de conexão com MCP oficial da Figma

============================================================

📡 Teste 1: Conexão SSE com https://mcp.figma.com/mcp
✅ Transport SSE criado com sucesso

🔐 Teste 2: Autenticação com Figma API
🔑 Token encontrado: figd_xxxxx...
✅ Cliente MCP criado
✅ Cliente conectado com sucesso

🔧 Teste 3: Listando tools disponíveis
✅ 13 tools encontradas:

1. get_design_context
   Descrição: Get structured design context from a Figma file...
   
2. get_metadata
   Descrição: Get sparse XML metadata...
   
[... mais 11 tools]

🎯 Teste 4: Chamando tool "whoami"
✅ Tool executada com sucesso
Resposta: {
  "id": "...",
  "email": "...",
  "handle": "..."
}

============================================================
📊 RESUMO DOS TESTES

✅ Sucessos: 4/4 (100.0%)
❌ Falhas: 0/4

============================================================

🎉 TODOS OS TESTES PASSARAM!
✅ O MCP Bridge é VIÁVEL tecnicamente
📝 Próximo passo: Implementar o bridge
```

---

## ❌ Possíveis Erros e Soluções

### Erro 1: "FIGMA_ACCESS_TOKEN não configurado"

**Causa:** Variável de ambiente não definida

**Solução:**
```bash
# Crie o arquivo .env com seu token
echo "FIGMA_ACCESS_TOKEN=figd_seu_token" > .env
```

---

### Erro 2: "Cannot find module '@modelcontextprotocol/sdk'"

**Causa:** Dependências não instaladas

**Solução:**
```bash
npm install @modelcontextprotocol/sdk
```

---

### Erro 3: "Failed to connect to https://mcp.figma.com/mcp"

**Possíveis causas:**
1. Servidor MCP oficial está offline
2. Firewall/proxy bloqueando a conexão
3. URL incorreta

**Soluções:**
1. Verifique se `https://mcp.figma.com/mcp` está acessível no navegador
2. Tente desabilitar proxy/VPN temporariamente
3. Verifique logs de firewall

---

### Erro 4: "Unauthorized" ou "Invalid token"

**Causa:** Token inválido, expirado ou sem permissões

**Solução:**
1. Gere um novo token em: https://www.figma.com/developers/api#access-tokens
2. Verifique se o token tem permissões de leitura
3. Atualize o `.env` com o novo token

---

### Erro 5: "SSEClientTransport is not a constructor"

**Causa:** Versão incompatível do SDK MCP

**Solução:**
```bash
npm install @modelcontextprotocol/sdk@latest
```

---

## 📝 Documentando os Resultados

Após executar o teste, documente os resultados:

### Se TODOS os testes passaram ✅

**Conclusão:** O MCP Bridge é **VIÁVEL**

**Próximos passos:**
1. Implementar o bridge (stdio → SSE)
2. Testar com AI Cockpit Reasoning
3. Adicionar features (cache, retry, logging)

### Se ALGUNS testes falharam ⚠️

**Ação necessária:**
1. Identifique qual teste falhou
2. Consulte a seção "Possíveis Erros" acima
3. Resolva o problema antes de prosseguir

### Se TODOS os testes falharam ❌

**Possíveis cenários:**
1. **MCP oficial não está disponível via SSE**
   - Solução: Continuar com o fork atual
   
2. **Problemas de rede/firewall**
   - Solução: Resolver problemas de infraestrutura
   
3. **SDK incompatível**
   - Solução: Pesquisar alternativas de conexão SSE

---

## 🔍 Informações Adicionais

### Estrutura do MCP Oficial

Se os testes passarem, você terá confirmado:

1. ✅ **Endpoint:** `https://mcp.figma.com/mcp` está acessível
2. ✅ **Protocolo:** SSE (Server-Sent Events) funciona
3. ✅ **Autenticação:** Bearer token via `FIGMA_ACCESS_TOKEN`
4. ✅ **Tools:** 13 tools disponíveis (incluindo write operations)

### Próxima Fase: Implementação do Bridge

Com os testes passando, você pode implementar:

```typescript
// Arquitetura do Bridge
AI Cockpit (stdio) 
    ↓
Bridge Local (Node.js)
    ↓ (SSE)
MCP Figma Oficial
```

**Componentes necessários:**
1. Servidor stdio (para AI Cockpit)
2. Cliente SSE (para MCP oficial)
3. Lógica de proxy (mapear chamadas)
4. Tratamento de erros
5. Reconexão automática

---

## 📞 Suporte

Se encontrar problemas não documentados aqui:

1. Verifique os logs detalhados do teste
2. Consulte a documentação do MCP SDK: https://modelcontextprotocol.io
3. Consulte a documentação da Figma API: https://www.figma.com/developers/api

---

## 🎯 Checklist de Validação

Antes de prosseguir para a implementação do bridge, confirme:

- [ ] Teste 1 passou (Conexão SSE)
- [ ] Teste 2 passou (Autenticação)
- [ ] Teste 3 passou (Listagem de tools)
- [ ] Teste 4 passou (Chamada de tool)
- [ ] Documentou os resultados
- [ ] Entendeu a arquitetura do MCP oficial
- [ ] Pronto para implementar o bridge

---

**Última atualização:** 2026-03-23