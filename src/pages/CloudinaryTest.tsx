import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { CarouselBuilder } from '@/components/CarouselBuilder';
import { runAllTests, TestResult, formatTestResults } from '@/lib/cloudinary/tests';
import { Loader2, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Test page for the new Cloudinary architecture
 * Provides UI to run tests and use the CarouselBuilder
 */
export default function CloudinaryTest() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const handleRunTests = async () => {
    setRunning(true);
    setResults([]);
    
    try {
      const testResults = await runAllTests();
      setResults(testResults);
      
      const passed = testResults.filter(r => r.passed).length;
      const failed = testResults.filter(r => !r.passed).length;
      
      if (failed === 0) {
        toast.success(`All ${passed} tests passed! 🎉`);
      } else {
        toast.error(`${failed} test(s) failed out of ${testResults.length}`);
      }
    } catch (error: any) {
      toast.error(`Test suite failed: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleSlideCreated = (publicId: string, url: string) => {
    toast.success(`Slide created: ${publicId}`);
    console.log('Slide URL:', url);
  };

  return (
    <AppLayoutWithSidebar>
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Cloudinary Architecture Test</h1>
          <p className="text-muted-foreground">
            Test the new centralized Cloudinary setup with Phase 1-7 implementations
          </p>
        </div>

        {/* Test Suite */}
        <Card>
          <CardHeader>
            <CardTitle>Phase 6: Test Suite</CardTitle>
            <CardDescription>
              Run automated tests to verify the Cloudinary integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleRunTests}
              disabled={running}
              className="w-full"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running tests...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run All Tests
                </>
              )}
            </Button>

            {results.length > 0 && (
              <div className="space-y-2 mt-4">
                <h3 className="font-semibold">Results:</h3>
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      result.passed
                        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">
                          {result.name}{' '}
                          <span className="text-sm text-muted-foreground">
                            ({result.duration}ms)
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                    {formatTestResults(results)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carousel Builder */}
        <CarouselBuilder
          brandId="test_brand_123"
          campaignId="test_campaign_456"
          onSlideCreated={handleSlideCreated}
        />

        {/* Architecture Info */}
        <Card>
          <CardHeader>
            <CardTitle>Architecture Overview</CardTitle>
            <CardDescription>
              Summary of the implemented phases
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 1: Centralized Edge Function</h4>
                <p className="text-sm text-muted-foreground">
                  <code>/cloudinary</code> function handles sign, upload, upload_large, delete, and ping actions
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 2: Frontend Helpers</h4>
                <p className="text-sm text-muted-foreground">
                  <code>src/lib/cloudinary/</code> contains upload.ts, imageUrls.ts, and videoUrls.ts
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 3: Function Migration</h4>
                <p className="text-sm text-muted-foreground">
                  <code>alfie-render-carousel-slide</code> now uses centralized /cloudinary function
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 4: Naming Convention</h4>
                <p className="text-sm text-muted-foreground">
                  Structure: <code>alfie/&#123;brandId&#125;/&#123;campaignId&#125;/slides/slide_XX</code>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 5: React Components</h4>
                <p className="text-sm text-muted-foreground">
                  <code>CarouselBuilder</code> component with real-time preview
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 6: Testing</h4>
                <p className="text-sm text-muted-foreground">
                  Automated test suite in <code>src/lib/cloudinary/tests.ts</code>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">✅ Phase 7: Backfill Function</h4>
                <p className="text-sm text-muted-foreground">
                  <code>/backfill-carousel-public-ids</code> edge function to migrate legacy data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayoutWithSidebar>
  );
}
