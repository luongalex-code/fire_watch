import os

file_path = r'C:\Class\IOT\project_final_iot\fe\src\features\firewatch\layouts\CriticalFireOverlay.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

import re

# 1. Add ttsSettings state
state_def = """  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [ttsSettings, setTtsSettings] = useState<any>(null);

  useEffect(() => {
    import('../services').then(({ fireWatchService }) => {
      fireWatchService.getSettings().then(setTtsSettings).catch(console.error);
    });
  }, []);
"""
content = content.replace('  const [isAcknowledging, setIsAcknowledging] = useState(false);', state_def)

# 2. Render helper function
helper = """  const renderTtsTemplate = useCallback((template: string, session: TtsSession, snapshot: TtsSnapshot) => {
    let result = template;
    result = result.replace(/{areaName}/g, session.areaName);
    result = result.replace(/{personCount}/g, snapshot.personCount.toString());
    return result;
  }, []);

  const scheduleTtsRepeat = useCallback(() =>"""
content = content.replace('  const scheduleTtsRepeat = useCallback(() =>', helper)

# 3. scheduleTtsRepeat replacements
schedule_repeat = """  const scheduleTtsRepeat = useCallback(() => {
    clearTtsTimer();
    const delayMs = ttsSettings?.ttsRepeatDelayMs ?? (Math.max(0.1, TTS_REPEAT_DELAY_SECONDS) * 1000);
    ttsTimerRef.current = window.setTimeout(() => {
      const snapshot = getTtsSnapshot();
      const session = ttsSessionRef.current;
      if (!session || !snapshot.fireActive) {
        stopTtsCompletely();
        return;
      }

      if (ttsSettings?.ttsFireRepeatEnabled ?? true) {
        enqueueTts({
          type: 'fire-repeat',
          text: renderTtsTemplate(ttsSettings?.ttsFireRepeatMessage || `Cảnh báo cháy tại {areaName}.`, session, snapshot),
          alertId: session.alertId,
        });
      }

      if (snapshot.personDetected) {
        if (ttsSettings?.ttsPersonRepeatEnabled ?? true) {
          enqueueTts({
            type: 'person-repeat',
            text: renderTtsTemplate(ttsSettings?.ttsPersonRepeatMessage || `Phát hiện {personCount} người tại {areaName}.`, session, snapshot),
            alertId: session.alertId,
          });
        }
      }
    }, delayMs);
  }, [clearTtsTimer, enqueueTts, getTtsSnapshot, stopTtsCompletely, ttsSettings, renderTtsTemplate]);"""
content = re.sub(r'  const scheduleTtsRepeat = useCallback\(\(\) => \{.*?  \}, \[clearTtsTimer, enqueueTts, getTtsSnapshot, stopTtsCompletely\]\);', schedule_repeat, content, flags=re.DOTALL)

# 4. initial TTS and person detected replacements
useEffect_tts = """        const session = ttsSessionRef.current;
        if (ttsSettings?.ttsInitialEnabled ?? true) {
          const rawMessage = ttsSettings?.ttsInitialMessage || `Chú ý, chú ý. Cảnh báo cháy tại {areaName}.`;
          const fireMessage = renderTtsTemplate(rawMessage, session, snapshot);
          const repeatCount = ttsSettings?.ttsInitialRepeatCount ?? 2;
          const fullMessage = Array(repeatCount).fill(fireMessage).join(' ');
          enqueueTts({ type: 'fire-initial', text: fullMessage, alertId: session.alertId }, true);
        }
        return;
      }

      previousSession.areaName = snapshot.areaName;
      previousSession.fireWasActive = true;
    }

    if (snapshot.fireActive && !previous.personDetected && snapshot.personDetected && ttsSessionRef.current) {
      if (ttsSettings?.ttsPersonDetectedEnabled ?? true) {
        enqueueTts({
          type: 'person-detected',
          text: renderTtsTemplate(ttsSettings?.ttsPersonDetectedMessage || `Phát hiện {personCount} người tại {areaName}.`, ttsSessionRef.current, snapshot),
          alertId: ttsSessionRef.current.alertId,
        });
      }
    }


  }, [enqueueTts, getTtsSnapshot, sanitizeTtsQueue, stopTtsCompletely, ttsSettings, renderTtsTemplate]);"""

content = re.sub(r'        const session = ttsSessionRef\.current;\s*const fireMessage = `Chú ý, chú ý\. Cảnh báo cháy tại \$\{session\.areaName\}\.`;\s*enqueueTts\(\{ type: \'fire-initial\', text: `\$\{fireMessage\} \$\{fireMessage\}`.*?\n  \}, \[enqueueTts, getTtsSnapshot, sanitizeTtsQueue, stopTtsCompletely\]\);', useEffect_tts, content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
