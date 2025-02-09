// Jenkins related types
export interface JenkinsBuild {
    full_url: string;
    number: number;
    phase: string;
    status: string;
    duration: number;
    timestamp: number;
    scm?: {
        branch?: string;
        commit?: string;
    };
}

export interface JenkinsWebhookPayload {
    build: JenkinsBuild;
    name: string;
    display_name: string;
}

// Docker related types
export interface DockerEventAttributes {
    name?: string;
    image?: string;
    exitCode?: string;
    status?: string;
    [key: string]: string | undefined;
}

export interface DockerActor {
    ID: string;
    Attributes: DockerEventAttributes;
}

export interface DockerEvent {
    Type: string;
    Action: string;
    Actor: DockerActor;
    scope: string;
    time: number;
    status?: string;
}

// Bot related types
export interface BotCommand {
    command: string;
    description: string;
}

// Database related types
export interface User {
    chat_id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_admin: number;
    can_receive_notifications: number;
    created_at: string;
}

// Add this new interface for subscription requests
export interface SubscriptionRequest {
    chat_id: string;
    status: 'pending' | 'approved' | 'rejected';
    requested_at: string;
    processed_at?: string;
}
