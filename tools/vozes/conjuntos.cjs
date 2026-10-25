/* 5.0a.2: conjuntos de vozes simulados para o teste da escolha automática (tools/vozes/vozes-teste.cjs). Nomes, idiomas e voiceURI
   como esses navegadores devolvem em speechSynthesis.getVoices() num aparelho em português; a ordem segue a de cada navegador
   (vozes locais antes das online no Edge e no Chrome; no iPhone, ordem alfabética, com as vozes "novidade" Eloquence antes da Luciana).
   'atraso': ms até o navegador terminar de carregar a lista (o Chrome devolve [] e avisa com voiceschanged; o Edge traz primeiro as locais). */
const v = (name, lang, o) => Object.assign({ name, lang, voiceURI: name, localService: true, default: false }, o || {});
const online = { localService: false };
const ms = (n, lang, extra) => v('Microsoft ' + n, lang, extra);
const WIN_LOCAIS = [ms('Maria - Portuguese (Brazil)', 'pt-BR', { default: true }), ms('Daniel - Portuguese (Brazil)', 'pt-BR'), ms('Heloisa - Portuguese (Brazil)', 'pt-BR'),
  ms('David - English (United States)', 'en-US'), ms('Mark - English (United States)', 'en-US'), ms('Zira - English (United States)', 'en-US')];
const GOOGLE = [['Deutsch', 'de-DE'], ['US English', 'en-US'], ['UK English Female', 'en-GB'], ['UK English Male', 'en-GB'], ['español', 'es-ES'], ['español de Estados Unidos', 'es-US'],
  ['français', 'fr-FR'], ['हिन्दी', 'hi-IN'], ['Bahasa Indonesia', 'id-ID'], ['italiano', 'it-IT'], ['日本語', 'ja-JP'], ['한국의', 'ko-KR'], ['Nederlands', 'nl-NL'], ['polski', 'pl-PL'],
  ['português do Brasil', 'pt-BR'], ['русский', 'ru-RU'], ['普通话（中国大陆）', 'zh-CN'], ['粤語（香港）', 'zh-HK'], ['國語（臺灣）', 'zh-TW']].map(([n, l]) => v('Google ' + n, l, online));
const EDGE_ONLINE = [['AvaMultilingual', 'en-US', 'English (United States)'], ['AndrewMultilingual', 'en-US', 'English (United States)'], ['Aria', 'en-US', 'English (United States)'], ['Guy', 'en-US', 'English (United States)'],
  ['Elvira', 'es-ES', 'Spanish (Spain)'], ['Denise', 'fr-FR', 'French (France)'], ['Antonio', 'pt-BR', 'Portuguese (Brazil)'], ['Francisca', 'pt-BR', 'Portuguese (Brazil)'], ['Thalita', 'pt-BR', 'Portuguese (Brazil)'],
  ['ThalitaMultilingual', 'pt-BR', 'Portuguese (Brazil)'], ['Duarte', 'pt-PT', 'Portuguese (Portugal)'], ['Raquel', 'pt-PT', 'Portuguese (Portugal)']].map(([n, l, d]) => ms(n + ' Online (Natural) - ' + d, l, online));
const ffx = (n, l) => v('Microsoft ' + n, l, { voiceURI: 'urn:moz-tts:sapi:Microsoft ' + n + '?' + l });
const apple = (n, l, kind, o) => v(n, l, Object.assign({ voiceURI: 'com.apple.' + (kind === 'eloquence' ? 'eloquence.' + l + '.' + n.split(' ')[0] : 'voice.' + kind + '.' + l + '.' + n.split(' ')[0]) }, o || {}));
const IOS_NOVIDADE = ['Eddy', 'Flo', 'Reed', 'Rocko', 'Sandy', 'Shelley', 'Vovó', 'Vovô'].map(n => apple(n + ' (Português (Brasil))', 'pt-BR', 'eloquence'));
const IOS_BASE = [...IOS_NOVIDADE, apple('Felipe', 'pt-BR', 'compact'), apple('Luciana', 'pt-BR', 'compact', { default: true }), apple('Joana', 'pt-PT', 'compact'), apple('Catarina', 'pt-PT', 'compact'),
  apple('Samantha', 'en-US', 'compact'), apple('Daniel (Inglês (Reino Unido))', 'en-GB', 'compact'), apple('Mónica', 'es-ES', 'compact'), apple('Thomas', 'fr-FR', 'compact')]
  .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
module.exports = [
  { id: 'edge', nome: 'Edge no Windows 11', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', atraso: 400, parcial: true, vozes: [...WIN_LOCAIS, ...EDGE_ONLINE], espera: /Francisca Online/ },
  { id: 'edge-sem-rede', nome: 'Edge no Windows 11, sem internet', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', atraso: 0, falha: 'Online', pularEscolha: true, vozes: [...WIN_LOCAIS, ...EDGE_ONLINE], espera: /^Microsoft Maria - Portuguese/ },
  { id: 'chrome-win', nome: 'Chrome no Windows 11', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', atraso: 300, vozes: [...WIN_LOCAIS.slice(0, 2), ...WIN_LOCAIS.slice(3), ...GOOGLE], espera: /^Google português do Brasil$/ },
  { id: 'firefox-win', nome: 'Firefox no Windows 11', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', atraso: 0, vozes: [ffx('Maria Desktop - Portuguese(Brazil)', 'pt-BR'), ffx('David Desktop - English (United States)', 'en-US'), ffx('Zira Desktop - English (United States)', 'en-US')].map((x, i) => Object.assign(x, { default: i === 0 })), espera: /Maria Desktop/ },
  { id: 'iphone', nome: 'iPhone (Safari, iOS 18)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', atraso: 0, vozes: IOS_BASE, espera: /^Luciana$/ },
  { id: 'iphone-aprimorada', nome: 'iPhone com a Luciana Aprimorada baixada', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', atraso: 0,
    vozes: [...IOS_BASE, apple('Luciana (Aprimorada)', 'pt-BR', 'enhanced')].sort((a, b) => a.name.localeCompare(b.name, 'pt')), espera: /^Luciana \(Aprimorada\)$/ },
  { id: 'sem-voz', nome: 'Navegador sem voz em português (Linux)', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', atraso: 0, vozes: [v('English (America)+Max', 'en-US', { voiceURI: 'espeak-ng en-us' })], espera: null },
];
