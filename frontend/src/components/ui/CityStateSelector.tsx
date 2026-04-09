import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface CityStateSelectorProps {
  cityValue?: string;
  stateValue?: string;
  onChange: (city: string, state: string, lat?: string, lng?: string) => void;
  disabled?: boolean;
}

export function CityStateSelector({
  cityValue,
  stateValue,
  onChange,
  disabled = false
}: CityStateSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [indianCities, setIndianCities] = React.useState<any[]>([])
  
  // Load heavy geo data asynchronously
  React.useEffect(() => {
    async function loadData() {
      try {
        const { City, State } = await import('country-state-city')
        const cities = City.getCitiesOfCountry('IN') || []
        const states = State.getStatesOfCountry('IN') || []
        
        // Create a map for quick state lookup
        const stateMap = new Map(states.map(s => [s.isoCode, s.name]))
        
        const processed = cities.map(city => ({
          city: city.name,
          state: stateMap.get(city.stateCode) || city.stateCode,
          lat: city.latitude,
          lng: city.longitude,
          label: `${city.name}, ${stateMap.get(city.stateCode) || city.stateCode}`,
          value: `${city.name.toLowerCase()}-${city.stateCode.toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`
        }))
        
        setIndianCities(processed)
      } catch (error) {
        console.error('Failed to load cities:', error)
      } finally {
        setLoading(false)
      }
    }
    
    // Tiny delay to ensure critical path loads first
    const timer = setTimeout(() => {
      loadData()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const currentValue = React.useMemo(() => {
    if (!cityValue || !stateValue) return ""
    return `${cityValue}, ${stateValue}`
  }, [cityValue, stateValue])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-10 border-muted-foreground/20 bg-background"
          disabled={disabled || loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading cities...</span>
            </div>
          ) : currentValue ? (
            <span className="truncate">{currentValue}</span>
          ) : (
            <span className="text-muted-foreground">Search for city...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 shadow-lg border-muted/40" align="start">
        <Command className="rounded-lg border shadow-md" filter={(value, search) => {
          if (value.toLowerCase().includes(search.toLowerCase())) return 1
          return 0
        }}>
          <CommandInput 
            placeholder="Type city or state name..." 
            className="h-11 border-none focus:ring-0"
          />
          <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {loading ? "Loading cities..." : "No city found."}
            </CommandEmpty>
            {!loading && (
              <CommandGroup heading="All Indian Cities">
                {indianCities.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    onSelect={() => {
                      onChange(item.city, item.state, item.lat || undefined, item.lng || undefined)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 text-orange-600 shrink-0",
                        currentValue === item.label ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium text-foreground">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
