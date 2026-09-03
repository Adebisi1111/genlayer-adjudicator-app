// Agent Payment Adjudicator - Plain JavaScript (no modules)
(function() {
  const ADDR = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
  const RPC = "https://rpc-bradbury.genlayer.com";
  const CHAIN_ID = 6675;

  let client = null;
  let account = null;
  let isConnected = false;

  // Wait for DOM to be ready
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function() {
    console.log('DOM ready, initializing...');
    
    const btn = document.getElementById('connectBtn');
    const addrEl = document.getElementById('addr');
    const noteEl = document.getElementById('netNote');

    if (!btn) {
      console.error('connectBtn NOT FOUND');
      return;
    }

    // Connect wallet function
    window.connectWallet = async function() {
      if (isConnected) {
        console.log('Already connected');
        return;
      }

      addrEl.textContent = 'Connecting...';
      try {
        if (!window.ethereum) {
          addrEl.textContent = 'Wallet not detected';
          return;
        }

        // Dynamic import of viem
        const { createWalletClient, custom } = await import('viem');
        
        const CHAIN = {
          id: CHAIN_ID,
          name: "GenLayer Bradbury Testnet",
          rpcUrls: { default: { http: [RPC] } },
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        };

        client = createWalletClient({
          chain: CHAIN,
          transport: custom(window.ethereum),
        });

        const accounts = await client.getAddresses();
        if (!accounts?.length) throw new Error('No accounts found');

        account = { address: accounts[0] };
        isConnected = true;

        addrEl.textContent = accounts[0].slice(0,6) + '...' + accounts[0].slice(-4);
        noteEl.innerHTML = '<span style="color:#4ade80">● Connected</span>';
        btn.textContent = 'Disconnect';

        console.log('Connected as', accounts[0]);

      } catch(e) {
        addrEl.textContent = 'Failed: ' + e.message;
        console.error('Connection error:', e);
      }
    };

    // Disconnect wallet function
    window.disconnectWallet = function() {
      client = null;
      account = null;
      isConnected = false;
      addrEl.textContent = 'Not connected';
      noteEl.textContent = '';
      btn.textContent = 'Connect Wallet';
      console.log('Disconnected');
    };

    // Button click handler
    btn.addEventListener('click', function() {
      if (isConnected) {
        window.disconnectWallet();
      } else {
        window.connectWallet();
      }
    });

    console.log('Button handler attached');
  });
})();
