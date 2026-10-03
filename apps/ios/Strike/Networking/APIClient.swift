import Foundation

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case unauthorized
    case server(status: Int, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "That server address isn't a valid URL."
        case .unauthorized: "The server rejected the access token."
        case let .server(status, message): message.isEmpty ? "Server error \(status)." : message
        case let .decoding(detail): "Unexpected response from the server. \(detail)"
        case let .transport(message): message
        }
    }
}

/// Thin async/await client for the Strike API. Every route except `/api/health` sends the bearer token.
final class APIClient: Sendable {
    let baseURL: URL
    private let token: String?
    private let session: URLSession
    private let onUnauthorized: @Sendable () -> Void

    init(baseURL: URL, token: String?, onUnauthorized: @escaping @Sendable () -> Void = {}) {
        self.baseURL = baseURL
        self.token = token?.isEmpty == true ? nil : token
        self.onUnauthorized = onUnauthorized
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: config)
    }

    // MARK: Verbs

    func get<T: Decodable & Sendable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await send("GET", path, query: query, body: Optional<EmptyBody>.none)
    }

    func post<T: Decodable & Sendable>(_ path: String, _ body: some Encodable & Sendable = EmptyBody()) async throws -> T {
        try await send("POST", path, body: body)
    }

    func put<T: Decodable & Sendable>(_ path: String, _ body: some Encodable & Sendable) async throws -> T {
        try await send("PUT", path, body: body)
    }

    func delete<T: Decodable & Sendable>(_ path: String) async throws -> T {
        try await send("DELETE", path, body: Optional<EmptyBody>.none)
    }

    /// Polls a coach job every couple of seconds until it succeeds or fails, giving up after `timeout`.
    func waitForJob(_ id: Int, interval: Duration = .seconds(2.5), timeout: Duration = .seconds(900)) async throws -> Job {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while true {
            let job: Job = try await get("/api/jobs/\(id)")
            if job.status.isFinished { return job }
            guard clock.now < deadline else {
                throw APIError.transport("The coach is taking longer than expected. Check back in a bit.")
            }
            try await Task.sleep(for: interval)
        }
    }

    // MARK: Core

    private func send<T: Decodable & Sendable, B: Encodable & Sendable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: B?
    ) async throws -> T {
        guard var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token, path != "/api/health" {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as URLError {
            throw APIError.transport(Self.describe(error))
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("No HTTP response.")
        }
        if http.statusCode == 401 {
            onUnauthorized()
            throw APIError.unauthorized
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw APIError.server(status: http.statusCode, message: body?.message ?? "")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch let error as DecodingError {
            throw APIError.decoding(Self.describe(error, path: path))
        }
    }

    /// `{ error, details? }`; for validation failures `details` holds zod issues.
    private struct ErrorBody: Decodable {
        var error: String
        var details: JSONValue?

        var message: String {
            guard case let .array(issues)? = details, case let .object(first)? = issues.first,
                  case let .string(text)? = first["message"] else { return error }
            var field = ""
            if case let .array(path)? = first["path"] {
                field = path.compactMap { part -> String? in
                    switch part {
                    case let .string(key): key
                    case let .number(index): String(Int(index))
                    default: nil
                    }
                }.joined(separator: ".")
            }
            return field.isEmpty ? "\(error): \(text)" : "\(error): \(field) — \(text)"
        }
    }

    private static func describe(_ error: URLError) -> String {
        switch error.code {
        case .notConnectedToInternet: "You're offline."
        case .timedOut: "The server took too long to answer."
        case .cannotFindHost, .dnsLookupFailed: "Can't find the server. Is Tailscale connected?"
        case .cannotConnectToHost: "Can't reach the server. Is it running, and is Tailscale connected?"
        case .appTransportSecurityRequiresSecureConnection: "This address needs HTTPS."
        default: error.localizedDescription
        }
    }

    private static func describe(_ error: DecodingError, path: String) -> String {
        func keyPath(_ context: DecodingError.Context) -> String {
            context.codingPath.map { $0.intValue.map { "[\($0)]" } ?? ".\($0.stringValue)" }.joined()
        }
        return switch error {
        case let .keyNotFound(key, context): "\(path): missing \(keyPath(context)).\(key.stringValue)"
        case let .typeMismatch(_, context), let .valueNotFound(_, context), let .dataCorrupted(context):
            "\(path): \(keyPath(context)) \(context.debugDescription)"
        @unknown default: "\(path): \(error.localizedDescription)"
        }
    }
}
