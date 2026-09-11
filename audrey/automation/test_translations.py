import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name('geocoins_translate.py')

class TranslationTests(unittest.TestCase):
    def test_non_english_is_added_without_changing_original(self):
        self.assertTrue(MODULE.exists(), 'translation enrichment is missing')
        spec = importlib.util.spec_from_file_location('translations', MODULE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        original = 'Díky za ukázku\n❤️'
        data = {'coins': [{'logs': [{'id': 'one', 'text': original}]}]}
        with tempfile.TemporaryDirectory() as folder:
            module.enrich(data, Path(folder)/'cache.json', translate=lambda texts: [
                {'sourceLanguage': 'cs', 'english': 'Thanks for showing it\n❤️'} for text in texts])
        log = data['coins'][0]['logs'][0]
        self.assertEqual(log['text'], original)
        self.assertEqual(log['translation']['text'], 'Thanks for showing it\n❤️')
        self.assertEqual(log['translation']['sourceText'], original)

    def test_daily_collector_enriches_before_atomic_output(self):
        import sys
        from unittest.mock import patch
        sys.path.insert(0, str(MODULE.parent))
        spec = importlib.util.spec_from_file_location('refresh', '/Users/rosie/.hermes/scripts/geocoins_refresh.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'enrich'), 'daily collector is not wired to translation')
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)/'data.json'
            output.write_text('original output')
            with patch.object(module, 'collect', return_value={'coins': []}), patch.object(module, 'enrich', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError):
                    module.run_collect({}, output, None, None)
            self.assertEqual(output.read_text(), 'original output')

    def test_cache_skip_english_empty_emoji_and_invalidate_changed_text(self):
        import sys
        sys.path.insert(0, str(MODULE.parent))
        from geocoins_translate import enrich
        logs = [{'text': text} for text in ['Hello!', '', '❤️', 'Díky', 'Díky']]
        data = {'coins': [{'logs': logs}]}
        calls = []
        def provider(texts):
            calls.append(texts)
            return [{'sourceLanguage': 'en' if text == 'Hello!' else 'cs', 'english': '' if text == 'Hello!' else 'Thanks'} for text in texts]
        with tempfile.TemporaryDirectory() as folder:
            cache = Path(folder)/'cache.json'
            enrich(data, cache, provider)
            enrich(data, cache, provider)
            self.assertEqual(calls, [['Hello!', 'Díky']])
            self.assertFalse(any('translation' in log for log in logs[:3]))
            self.assertTrue(all('translation' in log for log in logs[3:]))
            logs[3]['text'] = 'Hello!'
            enrich(data, cache, provider)
            self.assertNotIn('translation', logs[3])

if __name__ == '__main__':
    unittest.main()
