import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append('usr', email)
      form.append('pwd', password)

      const res = await fetch('/api/method/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: form.toString()
      })

      if (res.ok) {
        toast.success('Logged in successfully')
        // Reload to let server set boot and session
        window.location.href = '/dinematters'
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = data?.message || 'Login failed'
        toast.error(msg)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">Welcome to Dinematters</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">Sign in to manage your restaurants</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1">Username or Email</label>
            <Input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username or you@company.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <a href="/forgot-password" className="text-sm text-muted-foreground hover:underline">Forgot?</a>
            </div>
          </div>
          <div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

