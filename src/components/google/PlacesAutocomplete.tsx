'use client'

import { StandaloneSearchBox, useJsApiLoader } from '@react-google-maps/api'
import { useRef } from 'react'
import { Input } from '~/components/ui'
import { env } from '~/env'

interface PlacesAutocompleteProps {
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void
  className?: string
  placeholder?: string
}

const libraries: 'places'[] = ['places']

export default function PlacesAutocomplete({
  onPlaceSelect,
  className,
  placeholder = 'Search for your facility address',
}: PlacesAutocompleteProps) {
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
    language: 'en',
    region: 'US',
  })

  if (loadError) {
    console.error('Error loading Google Maps:', loadError)
    return null
  }

  if (!isLoaded) return null

  const onPlacesChanged = () => {
    const places = searchBoxRef.current?.getPlaces()
    if (places && places.length > 0 && onPlaceSelect) {
      onPlaceSelect(places[0]!)
    }
  }

  return (
    <StandaloneSearchBox
      onLoad={(ref) => (searchBoxRef.current = ref)}
      onPlacesChanged={onPlacesChanged}
    >
      <Input
        type="text"
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
      />
    </StandaloneSearchBox>
  )
}
