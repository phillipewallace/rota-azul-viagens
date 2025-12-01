package app.lovable.e145d80f177c4eb9987fd67c392fc5de;

import android.content.Intent;
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
    String action = intent.getAction();
    String type = intent.getType();

    // Verificar se é um compartilhamento de texto
    if (Intent.ACTION_SEND.equals(action) && type != null) {
      if ("text/plain".equals(type)) {
        handleSharedText(intent);
      }
    }
  }

  private void handleSharedText(Intent intent) {
    String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
    if (sharedText != null) {
      // Passar o texto compartilhado para o app via URL
      String url = "alchemyrotas://share?text=" + android.net.Uri.encode(sharedText);
      
      Intent webViewIntent = new Intent(Intent.ACTION_VIEW);
      webViewIntent.setData(android.net.Uri.parse(url));
      webViewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      
      // Notificar o Capacitor sobre a URL
      getBridge().handleIntent(webViewIntent);
    }
  }
}
