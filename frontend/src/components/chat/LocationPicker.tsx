import { useState, useEffect } from 'react'
import { X, MapPin, Navigation, Loader2, AlertCircle } from 'lucide-react'

interface LocationPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelectLocation: (latitude: number, longitude: number, locationName?: string) => void
}

export function LocationPicker({ isOpen, onClose, onSelectLocation }: LocationPickerProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [location, setLocation] = useState<{
        latitude: number
        longitude: number
        name?: string
    } | null>(null)

    // Manual input state
    const [manualLat, setManualLat] = useState('')
    const [manualLng, setManualLng] = useState('')
    const [locationName, setLocationName] = useState('')

    useEffect(() => {
        if (isOpen) {
            // Reset state when opened
            setError(null)
            setLocation(null)
        }
    }, [isOpen])

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser')
            return
        }

        setLoading(true)
        setError(null)

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                setLocation({ latitude, longitude })
                setManualLat(latitude.toFixed(6))
                setManualLng(longitude.toFixed(6))
                
                // Try to get location name using reverse geocoding
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    )
                    const data = await response.json()
                    if (data.display_name) {
                        const name = data.display_name.split(',').slice(0, 3).join(', ')
                        setLocationName(name)
                        setLocation(prev => prev ? { ...prev, name } : null)
                    }
                } catch (e) {
                    console.error('Failed to get location name:', e)
                }

                setLoading(false)
            },
            (err) => {
                setLoading(false)
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError('Location permission denied. Please enable location access.')
                        break
                    case err.POSITION_UNAVAILABLE:
                        setError('Location information is unavailable.')
                        break
                    case err.TIMEOUT:
                        setError('Location request timed out.')
                        break
                    default:
                        setError('An unknown error occurred.')
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        )
    }

    const handleManualSubmit = () => {
        const lat = parseFloat(manualLat)
        const lng = parseFloat(manualLng)

        if (isNaN(lat) || isNaN(lng)) {
            setError('Please enter valid coordinates')
            return
        }

        if (lat < -90 || lat > 90) {
            setError('Latitude must be between -90 and 90')
            return
        }

        if (lng < -180 || lng > 180) {
            setError('Longitude must be between -180 and 180')
            return
        }

        setLocation({ latitude: lat, longitude: lng, name: locationName || undefined })
        setError(null)
    }

    const handleSend = () => {
        if (location) {
            onSelectLocation(location.latitude, location.longitude, location.name)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl w-full max-w-md m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">Share Location</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Get Current Location Button */}
                    <button
                        onClick={getCurrentLocation}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Getting location...</span>
                            </>
                        ) : (
                            <>
                                <Navigation className="w-5 h-5" />
                                <span>Use Current Location</span>
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-700"></div>
                        <span className="text-slate-500 text-sm">or enter manually</span>
                        <div className="flex-1 h-px bg-slate-700"></div>
                    </div>

                    {/* Manual Input */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Latitude</label>
                                <input
                                    type="text"
                                    value={manualLat}
                                    onChange={(e) => setManualLat(e.target.value)}
                                    placeholder="e.g. 21.0278"
                                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Longitude</label>
                                <input
                                    type="text"
                                    value={manualLng}
                                    onChange={(e) => setManualLng(e.target.value)}
                                    placeholder="e.g. 105.8342"
                                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Location Name (optional)</label>
                            <input
                                type="text"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                                placeholder="e.g. Hanoi, Vietnam"
                                className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={handleManualSubmit}
                            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            Set Location
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Preview */}
                    {location && (
                        <div className="p-4 bg-slate-900 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-purple-400">
                                <MapPin className="w-4 h-4" />
                                <span className="font-medium">Selected Location</span>
                            </div>
                            {location.name && (
                                <p className="text-white">{location.name}</p>
                            )}
                            <p className="text-sm text-slate-400">
                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                            </p>
                            {/* Map preview link */}
                            <a
                                href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=15`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-purple-400 hover:text-purple-300 underline"
                            >
                                Preview on map ↗
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!location}
                        className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                        Share Location
                    </button>
                </div>
            </div>
        </div>
    )
}
