async function testRateLimit() {
  const baseUrl = 'http://localhost:3000'
  console.log('🧪 Testing rate limits...\n')

  console.log('📊 Test 1: GET /api/endpoints (limit: 60/min)')
  for (let i = 1; i <= 65; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/endpoints`)
      const status = res.status

      if (status === 429) {
        const retryAfter = res.headers.get('retry-after')
        console.log(`❌ Request ${i}: RATE LIMITED! Retry after ${retryAfter}s`)
        const data = await res.json()
        console.log(`   Message: ${data.error}`)
        break
      } else {
        console.log(`✅ Request ${i}: Success (${status})`)
      }
    } catch (error) {
      console.log(`❌ Request ${i}: Error - ${error.message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n---\n')

  console.log('📊 Test 2: POST /api/endpoints (limit: 10/min)')
  for (let i = 1; i <= 12; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Endpoint ${i}`,
          url: 'https://httpbin.org/status/200',
          checkInterval: 30,
          timeout: 5,
          expectedStatus: 200,
          severity: 'low',
          tags: ['test'],
        }),
      })

      const status = res.status

      if (status === 429) {
        const retryAfter = res.headers.get('retry-after')
        const resetTime = res.headers.get('x-ratelimit-reset')
        console.log(`❌ Request ${i}: RATE LIMITED!`)
        console.log(`   Retry after: ${retryAfter} seconds`)
        console.log(
          `   Reset time: ${new Date(resetTime).toLocaleTimeString()}`
        )
        break
      } else {
        console.log(`✅ Request ${i}: Success (${status})`)
      }
    } catch (error) {
      console.log(`❌ Request ${i}: Error - ${error.message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

testRateLimit()
