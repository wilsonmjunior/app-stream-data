import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session'
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react'
import { generateRandom } from 'expo-auth-session/build/PKCE'

import { api } from '../services/api'

interface User {
  id: number
  display_name: string
  email: string
  profile_image_url: string
}

interface AuthContextData {
  user: User
  isLoggingOut: boolean
  isLoggingIn: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

interface AuthProviderData {
  children: ReactNode
}

const AuthContext = createContext({} as AuthContextData)

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
}

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [user, setUser] = useState({} as User)
  const [userToken, setUserToken] = useState('')

  const { CLIENT_ID } = process.env

  async function signIn() {
    try {
      setIsLoggingIn(true)

      const redirectUri = makeRedirectUri({ useProxy: true })

      const responseType = 'token'
      const scope = encodeURI('openid user:read:email user:read:follows')
      const forceVerify = true
      const state = generateRandom(30)

      const authUrl = `${twitchEndpoints.authorization}?response_type=${responseType}&client_id=${CLIENT_ID}&scope=${scope}&state=${state}&forceVerify=${forceVerify}&redirect_uri=${redirectUri}`

      const authResponse = await startAsync({ authUrl })

      if (authResponse.type === 'success' && authResponse.params.error !== 'access_denied') {
        const { params } = authResponse
        if (params.state !== state) {
          throw new Error('Invalid state value.')
        }

        api.defaults.headers.authorization = `Bearer ${params.access_token}`;

        const { data: userResponse } = await api.get('/users')

        setUser({
          id: userResponse.data[0].id,
          display_name: userResponse.data[0].display_name,
          email: userResponse.data[0].email,
          profile_image_url: userResponse.data[0].profile_image_url,
        })
        setUserToken(params.access_token)
      }
    } catch (error) {
      throw new Error('Invalid login.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true)

      await revokeAsync({
        token: userToken,
        clientId: CLIENT_ID,
      }, {})
    } catch (error) {
    } finally {
      setUser({} as User)
      setUserToken('')

      delete api.defaults.headers.authorization

      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    api.defaults.headers['Client-Id'] = CLIENT_ID
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext)

  return context
}

export { AuthProvider, useAuth }
