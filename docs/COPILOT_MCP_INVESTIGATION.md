# Investigação: Como GitHub Copilot Acessa o MCP da Figma?

## 🎯 Pergunta Chave

**Se o GitHub Copilot consegue acessar o MCP remoto da Figma, como ele faz isso?**

## 🔍 Diferenças Possíveis

### 1. Método de Autenticação

#### GitHub Copilot
- Pode usar autenticação integrada do GitHub
- Pode ter OAuth app pré-aprovada pela Figma
- Pode usar token de sessão do VS Code
- Pode ter acesso via parceria Microsoft/Figma

#### AI Cockpit Reasoning
- Usa OAuth app custom (nossa)
- Token OAuth padrão
- Sem integração especial

### 2. Configuração do MCP

#### GitHub Copilot
```json
// Possível configuração do Copilot
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "auth": {
        "type": "github-integration",  // ← Diferença?
        "scopes": ["mcp:connect"]
      }
    }
  }
}
```

#### AI Cockpit
```json
// Nossa configuração
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["dist/bin.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

### 3. Tipo de Conexão

#### GitHub Copilot
- Pode usar SSE direto (servidor remoto)
- Autenticação via GitHub OAuth
- Token gerenciado pelo VS Code

#### AI Cockpit
- Usa stdio (servidor local)
- Precisa de bridge para remoto
- Token gerenciado manualmente

## 🔬 Hipóteses

### Hipótese 1: GitHub OAuth Integration
O Copilot pode usar a autenticação do GitHub que já está ativa no VS Code, e a Figma reconhece isso como válido.

### Hipótese 2: OAuth App Pré-Aprovada
A Microsoft/GitHub pode ter uma OAuth app pré-aprovada pela Figma com acesso ao MCP.

### Hipótese 3: Token de Sessão
O Copilot pode usar um token de sessão diferente, não OAuth padrão.

### Hipótese 4: Endpoint Diferente
O Copilot pode estar usando um endpoint diferente ou com parâmetros especiais.

## 📋 Testes Necessários

### Teste 1: Verificar Configuração do Copilot
```bash
# Verificar settings do VS Code
code --list-extensions | grep copilot
code --show-versions
```

### Teste 2: Inspecionar Requisições do Copilot
- Usar Fiddler/Charles Proxy
- Capturar requisições HTTP do Copilot
- Ver headers de autenticação usados

### Teste 3: Verificar Logs do Copilot
```
%APPDATA%\Code\logs\
~/.vscode/extensions/github.copilot-*/
```

### Teste 4: Comparar Tokens
- Token OAuth que obtivemos
- Token que o Copilot usa (se conseguirmos capturar)

## 🎯 Próximos Passos

1. **Verificar se você tem Copilot instalado**
   - Se sim: Verificar como ele está configurado para Figma
   - Se não: Instalar para testar

2. **Capturar requisições do Copilot**
   - Usar proxy para ver headers
   - Comparar com nossas requisições

3. **Verificar documentação do Copilot**
   - Procurar por configuração de MCP servers
   - Ver se há documentação sobre Figma integration

4. **Testar diferentes métodos de auth**
   - GitHub token
   - VS Code session token
   - Outros métodos

## 💡 Se Descobrirmos Como Funciona

Poderemos:
1. ✅ Replicar o método do Copilot
2. ✅ Fazer o AI Cockpit funcionar da mesma forma
3. ✅ Ter acesso às 13 tools do MCP oficial
4. ✅ Incluir write operations

## ❓ Perguntas para Investigar

1. O Copilot usa OAuth ou outro método?
2. Qual OAuth app o Copilot usa?
3. Há alguma integração especial GitHub/Figma?
4. O endpoint é realmente `https://mcp.figma.com/mcp`?
5. Quais headers o Copilot envia?

---

**Status:** Investigação em andamento
**Prioridade:** ALTA - Isso pode desbloquear o acesso ao MCP oficial