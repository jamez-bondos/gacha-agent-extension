// fetch-hook.js
(function () {
  if (window.gachaAgentSRFetchHooked) {
    // console.log('[GachaAgent Hook File] Fetch already overridden.');
    return;
  }
  const originalFetch = window.fetch;
  let currentRatio = null;
  let currentQuantity = null; // Added to store quantity

  console.log('[GachaAgent Hook File] Fetch hook initialized.');

  document.addEventListener('gachaAgentSRSetTaskDetails', function (event) {
    if (event.detail) {
      if (event.detail.ratio) {
        currentRatio = event.detail.ratio;
        console.log('[GachaAgent Hook File] Ratio updated to:', currentRatio);
      }
      if (event.detail.quantity) {
        currentQuantity = event.detail.quantity;
        console.log('[GachaAgent Hook File] Quantity updated to:', currentQuantity);
      }
    }
  });

  window.fetch = async function (url, options) {
    let modifiedOptions = options;
    const originalArguments = arguments;

    if (
      typeof url === 'string' &&
      url.includes('/backend/video_gen') &&
      options &&
      options.method &&
      options.method.toUpperCase() === 'POST'
    ) {
      console.log('[GachaAgent Hook File] Intercepted /backend/video_gen POST.');
      try {
        let body = JSON.parse(options.body);
        let modified = false;

        // Modify dimensions based on currentRatio
        if (currentRatio) {
          console.log('[GachaAgent Hook File] Current ratio setting:', currentRatio);
          const originalWidth = parseInt(body.width, 10) || 480;
          const originalHeight = parseInt(body.height, 10) || 480;
          const benchmarkValue = Math.min(originalWidth, originalHeight);
          let newWidth = originalWidth;
          let newHeight = originalHeight;

          console.log(
            `[GachaAgent Hook File] Original dimensions: w=${originalWidth}, h=${originalHeight}. Benchmark: ${benchmarkValue}. Target Ratio: ${currentRatio}`,
          );

          if (currentRatio === '1:1') {
            newWidth = benchmarkValue;
            newHeight = benchmarkValue;
          } else if (currentRatio === '2:3') {
            newWidth = benchmarkValue;
            newHeight = Math.round((benchmarkValue * 3) / 2);
          } else if (currentRatio === '3:2') {
            newHeight = benchmarkValue;
            newWidth = Math.round((benchmarkValue * 3) / 2);
          }

          newWidth = Math.round(newWidth / 8) * 8;
          newHeight = Math.round(newHeight / 8) * 8;

          if (body.width !== newWidth || body.height !== newHeight) {
            console.log(
              `[GachaAgent Hook File] Modifying dimensions from w=${body.width}, h=${body.height} to w=${newWidth}, h=${newHeight}`,
            );
            body.width = newWidth;
            body.height = newHeight;
            modified = true;
          }
        }

        // Modify number_of_images based on currentQuantity
        if (currentQuantity && body.number_of_images !== currentQuantity) {
          console.log(
            `[GachaAgent Hook File] Modifying number_of_images from ${body.number_of_images} to ${currentQuantity}`,
          );
          body.number_of_images = currentQuantity;
          modified = true;
        }

        if (modified) {
          modifiedOptions = { ...options, body: JSON.stringify(body) };
          console.log('[GachaAgent Hook File] Modified body for POST:', body);
        } else {
          console.log(
            '[GachaAgent Hook File] POST body not modified (no ratio/quantity change needed or values not set).',
          );
        }
      } catch (e) {
        console.error('[GachaAgent Hook File] Error modifying POST request body:', e);
      }
    }

    const fetchPromise = originalFetch.apply(
      this,
      modifiedOptions === options ? originalArguments : [url, modifiedOptions],
    );

    // After POST to /backend/video_gen, dispatch soraTaskSubmittedToPlatform event
    if (
      typeof url === 'string' &&
      url.includes('/backend/video_gen') &&
      options &&
      options.method &&
      options.method.toUpperCase() === 'POST'
    ) {
      fetchPromise
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            clone
              .json()
              .then(data => {
                if (data && data.id) {
                  // Assuming the response data itself has the soraId as 'id'
                  console.log('[GachaAgent Hook File] Task submitted successfully. Sora ID:', data.id);
                  document.dispatchEvent(
                    new CustomEvent('soraTaskSubmittedToPlatform', {
                      detail: {
                        soraId: data.id,
                        submittedAt: Date.now(),
                      },
                    }),
                  );
                } else if (Array.isArray(data) && data.length > 0 && data[0].id) {
                  // Or if it's an array with one task
                  console.log(
                    '[GachaAgent Hook File] Task submitted successfully (from array). Sora ID:',
                    data[0].id,
                  );
                  document.dispatchEvent(
                    new CustomEvent('soraTaskSubmittedToPlatform', {
                      detail: {
                        soraId: data[0].id,
                        submittedAt: Date.now(),
                      },
                    }),
                  );
                } else {
                  console.warn(
                    '[GachaAgent Hook File] POST /backend/video_gen response OK, but soraId not found in expected place:',
                    data,
                  );
                }
              })
              .catch(err => {
                console.error(
                  '[GachaAgent Hook File] Error parsing JSON from POST /backend/video_gen response:',
                  err,
                );
              });
          } else {
            console.error('[GachaAgent Hook File] POST /backend/video_gen failed. Status:', response.status);
          }
          return response; // Return original response to the chain
        })
        .catch(networkError => {
          console.error(
            '[GachaAgent Hook File] Network error during POST /backend/video_gen processing:',
            networkError,
          );
          // Do not re-throw here, as it might break the original page's error handling for the fetch
        });
    }

    if (
      typeof url === 'string' &&
      url.includes('/backend/video_gen') &&
      (!options || !options.method || options.method.toUpperCase() === 'GET')
    ) {
      return fetchPromise
        .then(response => {
          if (!response.ok) {
            console.log('[GachaAgent Hook File] GET /backend/video_gen response not OK, status:', response.status);
            return response;
          }
          const clonedResponse = response.clone();
          clonedResponse
            .json()
            .then(data => {
              if (data && data.task_responses) {
                console.log(
                  `[GachaAgent Hook File] GET /backend/video_gen response contains ${data.task_responses.length} tasks`,
                );
                const taskUpdates = data.task_responses.map(task => ({
                  id: task.id,
                  status: task.status,
                  progress_pct: task.progress_pct,
                  generations: task.generations,
                  title: task.title,
                  prompt: task.prompt,
                  failure_reason: task.failure_reason,
                }));
                document.dispatchEvent(
                  new CustomEvent('soraTaskStatusUpdate', {
                    detail: { tasks: taskUpdates },
                  }),
                );
              }
            })
            .catch(err => {
              console.error('[GachaAgent Hook File] Error parsing GET /backend/video_gen response JSON:', err);
            });
          return response;
        })
        .catch(networkError => {
          console.error(
            '[GachaAgent Hook File] Network error during GET /backend/video_gen processing:',
            networkError,
          );
          throw networkError;
        });
    }

    return fetchPromise;
  };
  window.gachaAgentSRFetchHooked = true;
  console.log('[GachaAgent Hook File] Fetch overridden successfully.');
})();
