'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import { Plus, Trash2, Car, MapPin, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface Vehicle {
  id: string
  rego: string
  country: 'AU' | 'NZ'
  owner_id: string
  created_at: string
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [rego, setRego] = useState('')
  const [country, setCountry] = useState<'AU' | 'NZ'>('AU')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const router = useRouter()

  const fetchVehicles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVehicles(data || [])
    } catch (error: any) {
      toast.error('Failed to fetch vehicles')
    } finally {
      setLoading(false)
    }
  }

  const addVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rego.trim()) {
      toast.error('Please enter a registration number')
      return
    }

    setAdding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { error } = await supabase
        .from('vehicles')
        .insert([
          {
            rego: rego.toUpperCase(),
            country,
            owner_id: user.id,
          },
        ])

      if (error) throw error

      toast.success('Vehicle added successfully!')
      setRego('')
      await fetchVehicles()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add vehicle')
    } finally {
      setAdding(false)
    }
  }

  const deleteVehicle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Vehicle deleted successfully')
      await fetchVehicles()
    } catch (error: any) {
      toast.error('Failed to delete vehicle')
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        fetchVehicles()
      }
    }

    checkAuth()

    // Real-time subscription
    const channel = supabase
      .channel('vehicles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicles',
          filter: `owner_id=eq.${supabase.auth.getUser()}`,
        },
        () => {
          fetchVehicles()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your vehicles...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-300 mb-2">My Vehicles</h1>
          <p className="text-gray-400">Manage your registered vehicles</p>
        </div>

        {/* Add Vehicle Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-600">
            <Car className="h-5 w-5 mr-2 text-blue-600" />
            Add New Vehicle
          </h2>
          <form onSubmit={addVehicle} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rego" className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Number
                </label>
                <input
                  id="rego"
                  type="text"
                  value={rego}
                  onChange={(e) => setRego(e.target.value)}
                  placeholder="e.g., ABC123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  disabled={adding}
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <div className="relative">
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value as 'AU' | 'NZ')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-gray-700"
                    disabled={adding}
                  >
                    <option value="AU">Australia (AU)</option>
                    <option value="NZ">New Zealand (NZ)</option>
                  </select>
                  <MapPin className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              {adding ? 'Adding...' : 'Add Vehicle'}
            </button>
          </form>
        </div>

        {/* Vehicles List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Your Vehicles ({vehicles.length})</h2>
          </div>
          
          {vehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No vehicles registered yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first vehicle using the form above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="shrink-0">
                        <Car className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-gray-900">{vehicle.rego}</p>
                        <div className="flex items-center mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            vehicle.country === 'AU' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {vehicle.country === 'AU' ? 'Australia' : 'New Zealand'}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            Added: {new Date(vehicle.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteVehicle(vehicle.id)}
                      className="text-red-600 hover:text-red-800 transition-colors p-2"
                      aria-label="Delete vehicle"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}