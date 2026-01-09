import SwiftUI
import Combine

class LocalizationService: ObservableObject {
    static let shared = LocalizationService()
    
    @Published var language: String = UserDefaults.standard.string(forKey: "appLanguage") ?? "IT" {
        didSet {
            UserDefaults.standard.set(language, forKey: "appLanguage")
        }
    }
    
    // Toggle
    func toggleLanguage() {
        language = (language == "IT") ? "EN" : "IT"
    }
    
    // Strings
    var serverName: String { language == "IT" ? "Nome Server" : "Server Name" }
    var connecting: String { language == "IT" ? "Connessione..." : "Connecting..." }
    var offline: String { language == "IT" ? "Offline" : "Off-Line" }
    var online: String { language == "IT" ? "Online" : "On-Line" }
    var noLibraries: String { language == "IT" ? "Nessuna libreria trovata." : "No libraries found." }
    var refresh: String { language == "IT" ? "Aggiorna" : "Refresh" }
    
    // Generic
    var library: String { language == "IT" ? "Libreria" : "Library" }
    var importText: String { language == "IT" ? "Importa" : "Import" }
    var options: String { language == "IT" ? "Impostazioni" : "Settings" } // Renamed
    var help: String { language == "IT" ? "Aiuto" : "Help" }
    var back: String { language == "IT" ? "Indietro" : "Back" }
    var appSettings: String { language == "IT" ? "Impostazioni Applicazione" : "Application Settings" }
    var appearance: String { language == "IT" ? "Lingua / Language" : "Language / Lingua" }
    
    // Settings
    var comicsServer: String { language == "IT" ? "Server Fumetti" : "Comics Server" }
    var serverTypeKey: String { language == "IT" ? "Tipo Server" : "Server Type" }
    var comingSoon: String { language == "IT" ? "In Arrivo" : "Coming Soon" }
    
    var serverConfig: String { language == "IT" ? "Configurazione Server" : "Server Configuration" }
    var serviceName: String { language == "IT" ? "Nome Servizio" : "Service Name" } // Legacy
    var serverAddress: String { language == "IT" ? "Indirizzo Server" : "Server Address" }
    var serverPort: String { language == "IT" ? "Porta" : "Port" }
    var serverUser: String { language == "IT" ? "Utente" : "User" }
    var serverPassword: String { language == "IT" ? "Password" : "Password" }
    
    var aiConfiguration: String { language == "IT" ? "Configurazione AI" : "AI Configuration" }
    var translationConfig: String { language == "IT" ? "Configurazione AI" : "AI Configuration" } // Deprecated alias
    var geminiKey: String { language == "IT" ? "Chiave API Gemini" : "Gemini API Key" }
    var status: String { language == "IT" ? "Stato" : "Status" }
    var verify: String { language == "IT" ? "Verifica & Connetti" : "Verify & Reconnect" }
    var modelFetchError: String { language == "IT" ? "Errore recupero modelli" : "Error fetching models" }
    var aiType: String { language == "IT" ? "Tipo AI" : "AI Type" }
    var checkModel: String { language == "IT" ? "Verifica Modelli" : "Check Available Model" }
    var apiKey: String { language == "IT" ? "Chiave API" : "API Key" }
    var validKeyModel: String { language == "IT" ? "Chiave Valida - Modello:" : "Valid API Key - Model:" }
    var dailyRPD: String { language == "IT" ? "Richieste Giornaliere:" : "Daily RPD:" }
    var peakRPD: String { language == "IT" ? "Picco Giornaliero:" : "Peak RPD:" }
    var availableModels: String { language == "IT" ? "Modelli Disponibili" : "Available Models" }
    
    // Web Server
    var webServer: String { language == "IT" ? "Web Server" : "Web Server" }
    var enableServer: String { language == "IT" ? "Abilita Server" : "Enable Server" }
    var serverError: String { language == "IT" ? "Errore Server" : "Server Error" }
    var unknownError: String { language == "IT" ? "Errore Sconosciuto" : "Unknown Error" }
    var waitingNetwork: String { language == "IT" ? "In attesa della rete..." : "Waiting for network..." }
    var dashboardLayout: String { language == "IT" ? "Layout Dashboard" : "Dashboard Layout" }
    var devVersion: String { language == "IT" ? "Versione Sviluppo" : "Development Version" }
    
    var skipIntro: String { language == "IT" ? "Salta Animazione Intro" : "Skip Intro Animation" }
    var about: String { language == "IT" ? "Informazioni" : "About" }
    var version: String { language == "IT" ? "Versione" : "Version" }
    
    var save: String { language == "IT" ? "SALVA" : "SAVE" }
    var edit: String { language == "IT" ? "MODIFICA" : "EDIT" }
    var close: String { language == "IT" ? "Chiudi" : "Close" }
    
    // Book List / Actions
    var select: String { language == "IT" ? "Seleziona" : "Select" }
    var cancel: String { language == "IT" ? "Annulla" : "Cancel" }
    var done: String { language == "IT" ? "Fine" : "Done" }
    var read: String { language == "IT" ? "Leggi" : "Read" }
    var download: String { language == "IT" ? "Scarica" : "Download" }
    var all: String { language == "IT" ? "Tutti" : "All" }
    var clear: String { language == "IT" ? "Svuota" : "Clear" }
}
