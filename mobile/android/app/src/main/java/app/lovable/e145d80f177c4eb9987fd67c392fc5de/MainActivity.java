package app.lovable.e145d80f177c4eb9987fd67c392fc5de;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    handleIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleIntent(intent);
  }

  private void handleIntent(Intent intent) {
    if (intent == null) return;
    
    String action = intent.getAction();
    String type = intent.getType();
    Uri data = intent.getData();

    // Verificar se é um compartilhamento de texto
    if (Intent.ACTION_SEND.equals(action) && type != null) {
      if ("text/plain".equals(type)) {
        handleSharedText(intent);
      }
    }
    // Verificar se é uma URL de localização (VIEW intent)
    else if (Intent.ACTION_VIEW.equals(action) && data != null) {
      handleLocationUri(data);
    }
  }

  private void handleSharedText(Intent intent) {
    String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
    if (sharedText != null && !sharedText.isEmpty()) {
      // Passar o texto compartilhado para o app via URL
      String encodedText = Uri.encode(sharedText);
      String url = "alchemyrotas://share?text=" + encodedText;
      
      try {
        Intent webViewIntent = new Intent(Intent.ACTION_VIEW);
        webViewIntent.setData(Uri.parse(url));
        webViewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        // Notificar o Capacitor sobre a URL
        if (getBridge() != null) {
          getBridge().handleIntent(webViewIntent);
        }
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
  }
  
  private void handleLocationUri(Uri data) {
    String uriString = data.toString();
    
    // Passar a URI de localização para o app
    String encodedUri = Uri.encode(uriString);
    String url = "alchemyrotas://location?uri=" + encodedUri;
    
    try {
      Intent webViewIntent = new Intent(Intent.ACTION_VIEW);
      webViewIntent.setData(Uri.parse(url));
      webViewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      
      // Notificar o Capacitor sobre a URL
      if (getBridge() != null) {
        getBridge().handleIntent(webViewIntent);
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}
