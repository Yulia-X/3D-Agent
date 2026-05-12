// 独立测试脚本，不依赖 config.ts
import 'dotenv/config'

const config = {
  GLM_API_KEY: process.env.GLM_API_KEY || '',
  GLM_MODEL: process.env.GLM_MODEL || 'glm-4.7',
  GLM_API_BASE: process.env.GLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4',
}

async function testGLM() {
  console.log('=== GLM API 配置检查 ===')
  console.log('API Key:', config.GLM_API_KEY ? '✓ 已配置 (' + config.GLM_API_KEY.substring(0, 10) + '...)' : '✗ 未配置')
  console.log('Model:', config.GLM_MODEL)
  console.log('Base URL:', config.GLM_API_BASE)
  console.log('')

  if (!config.GLM_API_KEY) {
    console.log('❌ GLM API Key 未配置，无法调用')
    return
  }

  console.log('=== 测试 GLM API 调用 ===')
  
  try {
    const response = await fetch(`${config.GLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.GLM_MODEL,
        messages: [
          { role: 'user', content: '你好，请回复"GLM连接成功"来测试连通性' }
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    })

    console.log('HTTP Status:', response.status)
    console.log('')

    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ 调用失败！')
      console.log('错误信息:', errorText)
      console.log('')
      console.log('可能的原因：')
      console.log('1. API Key 无效或已过期')
      console.log('2. 账户余额不足')
      console.log('3. 模型名称不正确')
      console.log('4. 网络问题或 API 服务不可用')
      return
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    console.log('✅ GLM API 调用成功！')
    console.log('回复内容:', content || '(空)')
    console.log('Finish reason:', data.choices?.[0]?.finish_reason)
    console.log('')
    console.log('完整响应数据:')
    console.log(JSON.stringify(data, null, 2))
    
  } catch (error) {
    console.log('❌ 调用异常！')
    console.log('错误:', error.message)
    console.log('')
    console.log('可能的原因：')
    console.log('1. 网络连接问题')
    console.log('2. Base URL 不正确')
    console.log('3. DNS 解析失败')
  }
}

testGLM()
