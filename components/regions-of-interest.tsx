"use client"

import Image from "next/image"
import { Card, CardContent } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Flag, Shield, User, X } from "lucide-react"
import { Button } from "./ui/button"
import { Dispatch, SetStateAction } from "react"
import { ROI } from "@/types/roi"

interface RegionsOfInterestProps {
  savedROIs: ROI[]
  selectedROI: number | null
  setSavedROIs: Dispatch<SetStateAction<ROI[]>>
  setSelectedROI: Dispatch<SetStateAction<number | null>>
}

export const RegionsOfInterest = ({ savedROIs, setSavedROIs, selectedROI, setSelectedROI }: RegionsOfInterestProps) => {

  const handleCategoryChange = (roiId: number, category: string) => {
    setSavedROIs(prev => prev.map(roi => 
      roi.id === roiId ? { ...roi, category } : roi
    ))
  }

  const handleDiscard = (roiId: number) => {
    setSavedROIs(prev => prev.filter(roi => roi.id !== roiId))
    if (selectedROI === roiId) {
      setSelectedROI(null)
    }
  }


    return (
      <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Regions of Interest</h2>
        <ScrollArea className="">
          <div className="grid grid-cols-5 gap-2">
            {savedROIs.map(roi => (
              <Card
                key={roi.id}
                className={`overflow-hidden  transition-all duration-200 ${
                  roi.id === selectedROI ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardContent className="p-4 space-y-2 bg-red-50 h-auto w-full">
                  {typeof roi.dataUrl === 'string' && roi.dataUrl && (
                    <div className="aspect-square relative overflow-hidden rounded-sm h-24 mx-auto w-full">
                      <Image
                        src={roi.dataUrl}
                        alt={`ROI ${roi.id}`}
                        layout="fill"
                        objectFit="contain"
                      />
                      {roi.category && (
                        <div className={`absolute inset-0 flex items-center justify-center ${
                          roi.category.startsWith('team_A') ? 'bg-blue-500/50' :
                          roi.category.startsWith('team_B') ? 'bg-red-500/50' :
                          roi.category.startsWith('referee') ? 'bg-yellow-500/50' : ''
                        }`}>
                          {roi.category.endsWith('/player') && <User className="w-8 h-8 text-white" />}
                          {roi.category.endsWith('/goalkeeper') && <Shield className="w-8 h-8 text-white" />}
                          {roi.category === 'referee/referee' && <Flag className="w-8 h-8 text-white" />}
                        </div>
                      )}
                    </div>
                  )}
                  <Select
                    value={roi.category || ''}
                    onValueChange={(value) => handleCategoryChange(roi.id, value)}
                    // size="sm"
                  >
                    <SelectTrigger className="w-full text-left">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="team_A/player">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-blue-500" />
                          Team A Player
                        </div>
                      </SelectItem>
                      <SelectItem value="team_A/goalkeeper">
                        <div className="flex items-center">
                          <Shield className="w-4 h-4 mr-2 text-blue-500" />
                          Team A Goalkeeper
                        </div>
                      </SelectItem>
                      <SelectItem value="team_B/player">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-red-500" />
                          Team B Player
                        </div>
                      </SelectItem>
                      <SelectItem value="team_B/goalkeeper">
                        <div className="flex items-center">
                          <Shield className="w-4 h-4 mr-2 text-red-500" />
                          Team B Goalkeeper
                        </div>
                      </SelectItem>
                      <SelectItem value="referee/referee">
                        <div className="flex items-center">
                          <Flag className="w-4 h-4 mr-2 text-yellow-500" />
                          Referee
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => handleDiscard(roi.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full text-s py-1 transition-colors duration-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Discard
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
    )
}
