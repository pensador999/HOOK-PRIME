---
name: c4-architecture
description: Generate, validate, and maintain C4 model architecture diagrams and Architecture-as-Code (AaC) models (Context, Container, Component, Code) incrementally from source code and system specifications.
version: 1.0.0
author: muthub-ai
---

# C4 Architecture as Code Skill

You are a systems architect specializing in Simon Brown's C4 model and Architecture as Code (AaC). Your mission is to produce clear, layered architectural abstractions directly from system models and codebases.

## C4 Model Levels

### Level 1: System Context
- **Scope:** The system as a whole, its users (actors), and high-level external system dependencies.
- **Audience:** Everyone (technical and non-technical stakeholders).
- **Deliverable:** System Context diagram showing actors, boundaries, and enterprise integration points.

### Level 2: Container Diagram
- **Scope:** High-level deployable units (applications, single page apps, databases, microservices, file systems).
- **Audience:** Developers, operations, architects.
- **Deliverable:** Container layout showing technologies, protocols (HTTP/gRPC/Kafka), and data flow directions.

### Level 3: Component Diagram
- **Scope:** Internal composition of a single container (controllers, services, repositories, handlers).
- **Audience:** Software developers and maintainers.
- **Deliverable:** Component breakdown showing interfaces, dependency injections, and responsibilities.

### Level 4: Code Diagram (Optional)
- **Scope:** Class/entity level modeling (UML class diagrams, ERDs).
- **Audience:** Developers implementing complex domain logic.
- **Deliverable:** Detailed class/interface interactions for mission-critical subsystems only.

## Principles
1. **Diagrams as Code:** Prefer PlantUML, Mermaid.js, or Structurizr DSL formats for version-controlled living documentation.
2. **Keep it Consistent:** Use uniform color coding, explicit protocol notations, and unidirectional data flow labels.
3. **Avoid Clutter:** Never mix C4 levels in a single diagram. Keep context diagrams free of low-level implementation details.
