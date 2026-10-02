# Third-party notices

## Stockfish / Stockfish.js

MoveWisely uses Stockfish 19 through the `stockfish` JavaScript/WebAssembly distribution. The package is GPL-3.0 licensed.

- Exact npm package used by this project: `stockfish@19.0.0`
- Stockfish source: https://github.com/official-stockfish/Stockfish
- Stockfish.js source/distribution: https://github.com/nmrugg/stockfish.js
- GPLv3 text/source distribution: https://github.com/official-stockfish/Stockfish/blob/master/Copying.txt

The build copies the browser-oriented `stockfish-19-lite-single.js` and `.wasm` assets without modifying the engine source. When changing the engine package or build flavor, re-check the exact license, corresponding-source requirements, and attribution obligations before releasing.
