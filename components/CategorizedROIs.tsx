import { ROI, Category } from '../types/roi'
import Image from 'next/image'

interface CategorizedROIsProps {
  rois: ROI[]
}

export function CategorizedROIs({ rois }: CategorizedROIsProps) {
  const categories: Category[] = ['teamA', 'teamB', 'referee']

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Categorized ROIs</h2>
      <div className="grid grid-cols-3 gap-4">
        {categories.map(category => (
          <div key={category} className="border p-4">
            <h3 className="text-lg font-medium mb-2">
              {category === 'teamA' ? 'Team A' : category === 'teamB' ? 'Team B' : 'Referee'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {rois
                .filter(roi => roi.category === category)
                .map(roi => (
                  <div key={roi.id} className="relative w-full h-32">
                    {
                      roi.dataUrl && (
                        <Image
                          src={roi.dataUrl}
                          alt={`${category} ROI ${roi.id}`}
                          layout="fill"
                          objectFit="contain"
                        />
                      )
                    }

                  </div>
                ))
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

