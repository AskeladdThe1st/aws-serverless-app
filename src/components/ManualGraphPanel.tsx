import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ManualGraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GraphFeatures) => void;
  isLoading?: boolean;
}

export interface GraphFeatures {
  xIntercepts: string[];
  yIntercept: string;
  endpoints: { point: string; type: 'open' | 'closed' }[];
  holes: string[];
  jumpDiscontinuities: string[];
  increasingIntervals: string[];
  decreasingIntervals: string[];
  concaveUpIntervals: string[];
  concaveDownIntervals: string[];
  inflectionPoints: string[];
  verticalAsymptotes: string[];
  horizontalAsymptotes: string[];
  domain: string;
  range: string;
  notes: string;
}

export function ManualGraphPanel({ isOpen, onClose, onSubmit, isLoading }: ManualGraphPanelProps) {
  const [features, setFeatures] = useState<GraphFeatures>({
    xIntercepts: [''],
    yIntercept: '',
    endpoints: [{ point: '', type: 'closed' }],
    holes: [''],
    jumpDiscontinuities: [''],
    increasingIntervals: [''],
    decreasingIntervals: [''],
    concaveUpIntervals: [''],
    concaveDownIntervals: [''],
    inflectionPoints: [''],
    verticalAsymptotes: [''],
    horizontalAsymptotes: [''],
    domain: '',
    range: '',
    notes: ''
  });

  const addArrayItem = (field: keyof GraphFeatures) => {
    if (Array.isArray(features[field])) {
      setFeatures({
        ...features,
        [field]: [...(features[field] as any[]), field === 'endpoints' ? { point: '', type: 'closed' } : '']
      });
    }
  };

  const removeArrayItem = (field: keyof GraphFeatures, index: number) => {
    if (Array.isArray(features[field])) {
      const arr = [...(features[field] as any[])];
      arr.splice(index, 1);
      setFeatures({ ...features, [field]: arr.length > 0 ? arr : [''] });
    }
  };

  const updateArrayItem = (field: keyof GraphFeatures, index: number, value: string | { point: string; type: 'open' | 'closed' }) => {
    if (Array.isArray(features[field])) {
      const arr = [...(features[field] as any[])];
      arr[index] = value;
      setFeatures({ ...features, [field]: arr });
    }
  };

  const handleSubmit = () => {
    const cleanedFeatures = {
      ...features,
      xIntercepts: features.xIntercepts.filter(x => x.trim()),
      holes: features.holes.filter(x => x.trim()),
      jumpDiscontinuities: features.jumpDiscontinuities.filter(x => x.trim()),
      increasingIntervals: features.increasingIntervals.filter(x => x.trim()),
      decreasingIntervals: features.decreasingIntervals.filter(x => x.trim()),
      concaveUpIntervals: features.concaveUpIntervals.filter(x => x.trim()),
      concaveDownIntervals: features.concaveDownIntervals.filter(x => x.trim()),
      inflectionPoints: features.inflectionPoints.filter(x => x.trim()),
      verticalAsymptotes: features.verticalAsymptotes.filter(x => x.trim()),
      horizontalAsymptotes: features.horizontalAsymptotes.filter(x => x.trim()),
      endpoints: features.endpoints.filter(e => e.point.trim())
    };
    onSubmit(cleanedFeatures);
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border z-50 animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Manual Graph Features</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <Accordion type="multiple" className="space-y-2">
            <AccordionItem value="intercepts">
              <AccordionTrigger>Intercepts</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>X-intercepts</Label>
                  {features.xIntercepts.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('xIntercepts', idx, e.target.value)}
                        placeholder="e.g., (2, 0)"
                      />
                      {features.xIntercepts.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('xIntercepts', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('xIntercepts')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Y-intercept</Label>
                  <Input
                    value={features.yIntercept}
                    onChange={(e) => setFeatures({ ...features, yIntercept: e.target.value })}
                    placeholder="e.g., (0, 3)"
                    className="mt-2"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="endpoints">
              <AccordionTrigger>Endpoints</AccordionTrigger>
              <AccordionContent className="space-y-3">
                {features.endpoints.map((endpoint, idx) => (
                  <div key={idx} className="space-y-2 p-3 border border-border rounded-md">
                    <Input
                      value={endpoint.point}
                      onChange={(e) => updateArrayItem('endpoints', idx, { ...endpoint, point: e.target.value })}
                      placeholder="e.g., (1, 2)"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant={endpoint.type === 'closed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateArrayItem('endpoints', idx, { ...endpoint, type: 'closed' })}
                      >
                        Closed
                      </Button>
                      <Button
                        variant={endpoint.type === 'open' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateArrayItem('endpoints', idx, { ...endpoint, type: 'open' })}
                      >
                        Open
                      </Button>
                      {features.endpoints.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('endpoints', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addArrayItem('endpoints')}>
                  <Plus className="h-4 w-4 mr-1" /> Add Endpoint
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="discontinuities">
              <AccordionTrigger>Discontinuities</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Holes</Label>
                  {features.holes.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('holes', idx, e.target.value)}
                        placeholder="e.g., (3, 5)"
                      />
                      {features.holes.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('holes', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('holes')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Jump Discontinuities</Label>
                  {features.jumpDiscontinuities.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('jumpDiscontinuities', idx, e.target.value)}
                        placeholder="e.g., x = 2"
                      />
                      {features.jumpDiscontinuities.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('jumpDiscontinuities', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('jumpDiscontinuities')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals">
              <AccordionTrigger>Behavior Intervals</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Increasing Intervals</Label>
                  {features.increasingIntervals.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('increasingIntervals', idx, e.target.value)}
                        placeholder="e.g., (-∞, 2)"
                      />
                      {features.increasingIntervals.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('increasingIntervals', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('increasingIntervals')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Decreasing Intervals</Label>
                  {features.decreasingIntervals.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('decreasingIntervals', idx, e.target.value)}
                        placeholder="e.g., (2, ∞)"
                      />
                      {features.decreasingIntervals.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('decreasingIntervals', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('decreasingIntervals')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="concavity">
              <AccordionTrigger>Concavity</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Concave Up Intervals</Label>
                  {features.concaveUpIntervals.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('concaveUpIntervals', idx, e.target.value)}
                        placeholder="e.g., (0, 5)"
                      />
                      {features.concaveUpIntervals.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('concaveUpIntervals', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('concaveUpIntervals')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Concave Down Intervals</Label>
                  {features.concaveDownIntervals.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('concaveDownIntervals', idx, e.target.value)}
                        placeholder="e.g., (5, ∞)"
                      />
                      {features.concaveDownIntervals.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('concaveDownIntervals', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('concaveDownIntervals')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Inflection Points</Label>
                  {features.inflectionPoints.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('inflectionPoints', idx, e.target.value)}
                        placeholder="e.g., (5, 10)"
                      />
                      {features.inflectionPoints.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('inflectionPoints', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('inflectionPoints')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="asymptotes">
              <AccordionTrigger>Asymptotes</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Vertical Asymptotes</Label>
                  {features.verticalAsymptotes.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('verticalAsymptotes', idx, e.target.value)}
                        placeholder="e.g., x = 3"
                      />
                      {features.verticalAsymptotes.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('verticalAsymptotes', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('verticalAsymptotes')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                <div>
                  <Label>Horizontal Asymptotes</Label>
                  {features.horizontalAsymptotes.map((val, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={val}
                        onChange={(e) => updateArrayItem('horizontalAsymptotes', idx, e.target.value)}
                        placeholder="e.g., y = 0"
                      />
                      {features.horizontalAsymptotes.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem('horizontalAsymptotes', idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addArrayItem('horizontalAsymptotes')}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="domain-range">
              <AccordionTrigger>Domain & Range</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Domain</Label>
                  <Input
                    value={features.domain}
                    onChange={(e) => setFeatures({ ...features, domain: e.target.value })}
                    placeholder="e.g., (-∞, ∞)"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Range</Label>
                  <Input
                    value={features.range}
                    onChange={(e) => setFeatures({ ...features, range: e.target.value })}
                    placeholder="e.g., [0, ∞)"
                    className="mt-2"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notes">
              <AccordionTrigger>Additional Notes</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={features.notes}
                  onChange={(e) => setFeatures({ ...features, notes: e.target.value })}
                  placeholder="Any additional observations or notes about the graph..."
                  rows={4}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Submit Graph Features'}
          </Button>
        </div>
      </div>
    </>
  );
}
