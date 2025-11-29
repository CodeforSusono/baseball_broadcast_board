/**
 * Settings Window Vue.js Application
 * Provides GUI for configuration management in Electron app
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      appVersion: '1.0.0',
      selectedYamlPath: null,
      yamlData: null,
      generateMessage: null,
      generateMessageClass: '',
      deleteMessage: null,
      deleteMessageClass: '',
      reloadMessage: null,
      reloadMessageClass: ''
    };
  },
  async mounted() {
    // Get app version from Electron
    if (window.electronAPI) {
      try {
        this.appVersion = await window.electronAPI.getVersion();
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    }
  },
  methods: {
    /**
     * Open file dialog to select YAML file
     */
    async selectYamlFile() {
      if (!window.electronAPI) {
        this.showError('generate', 'Electron環境でのみ使用可能です');
        return;
      }

      try {
        const result = await window.electronAPI.openFileDialog({
          title: 'YAML設定ファイルを選択',
          filters: [
            { name: 'YAML Files', extensions: ['yaml', 'yml'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        // Check if user cancelled
        if (result.canceled) {
          return;
        }

        // Get selected file path
        this.selectedYamlPath = result.filePaths[0];

        // Read and parse YAML file
        const yamlResult = await window.electronAPI.readYaml(this.selectedYamlPath);

        if (yamlResult.success) {
          this.yamlData = yamlResult.data;
          this.clearMessages('generate');
        } else {
          this.showError('generate', `YAMLファイルの読み込みに失敗しました: ${yamlResult.error}`);
          this.selectedYamlPath = null;
          this.yamlData = null;
        }
      } catch (error) {
        this.showError('generate', `ファイル選択エラー: ${error.message}`);
      }
    },

    /**
     * Generate init_data.json from selected YAML file
     */
    async generateConfig() {
      if (!window.electronAPI) {
        this.showError('generate', 'Electron環境でのみ使用可能です');
        return;
      }

      if (!this.selectedYamlPath) {
        this.showError('generate', 'YAMLファイルが選択されていません');
        return;
      }

      try {
        const result = await window.electronAPI.generateConfig(this.selectedYamlPath);

        if (result.success) {
          this.showSuccess('generate', result.message);

          // Auto-prompt to delete current game state
          if (confirm('設定ファイルを生成しました。\n試合状態も削除しますか?')) {
            await this.deleteCurrentGame();
          }
        } else {
          this.showError('generate', `設定生成エラー: ${result.error}`);
        }
      } catch (error) {
        this.showError('generate', `設定生成エラー: ${error.message}`);
      }
    },

    /**
     * Delete current game state
     */
    async deleteCurrentGame() {
      if (!window.electronAPI) {
        this.showError('delete', 'Electron環境でのみ使用可能です');
        return;
      }

      // Confirm deletion
      if (!confirm('試合状態を削除しますか?\n次回起動時に新しい設定が適用されます。')) {
        return;
      }

      try {
        const result = await window.electronAPI.deleteCurrentGame();

        if (result.success) {
          this.showSuccess('delete', result.message);

          // Auto-prompt to reload config
          if (confirm('試合状態を削除しました。\n設定を再読み込みしますか?')) {
            await this.reloadConfig();
          }
        } else {
          this.showError('delete', `削除エラー: ${result.error}`);
        }
      } catch (error) {
        this.showError('delete', `削除エラー: ${error.message}`);
      }
    },

    /**
     * Reload configuration (notify all windows)
     */
    async reloadConfig() {
      if (!window.electronAPI) {
        this.showError('reload', 'Electron環境でのみ使用可能です');
        return;
      }

      try {
        const result = await window.electronAPI.reloadConfig();

        if (result.success) {
          this.showSuccess('reload', result.message);
        } else {
          this.showError('reload', `再読み込みエラー: ${result.error}`);
        }
      } catch (error) {
        this.showError('reload', `再読み込みエラー: ${error.message}`);
      }
    },

    /**
     * Show success message
     * @param {string} target - 'generate', 'delete', or 'reload'
     * @param {string} message - Message to display
     */
    showSuccess(target, message) {
      if (target === 'generate') {
        this.generateMessage = message;
        this.generateMessageClass = 'alert-success';
      } else if (target === 'delete') {
        this.deleteMessage = message;
        this.deleteMessageClass = 'alert-success';
      } else if (target === 'reload') {
        this.reloadMessage = message;
        this.reloadMessageClass = 'alert-success';
      }

      // Auto-clear after 5 seconds
      setTimeout(() => this.clearMessages(target), 5000);
    },

    /**
     * Show error message
     * @param {string} target - 'generate', 'delete', or 'reload'
     * @param {string} message - Error message to display
     */
    showError(target, message) {
      if (target === 'generate') {
        this.generateMessage = message;
        this.generateMessageClass = 'alert-danger';
      } else if (target === 'delete') {
        this.deleteMessage = message;
        this.deleteMessageClass = 'alert-danger';
      } else if (target === 'reload') {
        this.reloadMessage = message;
        this.reloadMessageClass = 'alert-danger';
      }

      // Auto-clear after 5 seconds
      setTimeout(() => this.clearMessages(target), 5000);
    },

    /**
     * Clear messages
     * @param {string} target - 'generate', 'delete', or 'reload'
     */
    clearMessages(target) {
      if (target === 'generate') {
        this.generateMessage = null;
        this.generateMessageClass = '';
      } else if (target === 'delete') {
        this.deleteMessage = null;
        this.deleteMessageClass = '';
      } else if (target === 'reload') {
        this.reloadMessage = null;
        this.reloadMessageClass = '';
      }
    }
  }
}).mount('#app');
