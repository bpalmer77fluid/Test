import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { randomUUID } from 'crypto'
import { WebhookRegistrationService } from '../services/webhookRegistration'
import { WhatsAppService } from '../services/whatsappService'

export async function webhookRoutes(fastify: FastifyInstance) {
  // Webhook endpoint for Fluid platform events
  fastify.post('/api/webhook/fluid', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;

      // LOG EVERYTHING - Full webhook payload analysis
      fastify.log.info('🔍 === FULL WEBHOOK PAYLOAD ANALYSIS ===');
      fastify.log.info(`📦 Full body: ${JSON.stringify(body, null, 2)}`);
      fastify.log.info(`📋 Headers: ${JSON.stringify(request.headers, null, 2)}`);
      fastify.log.info(`🎯 Event type: ${body.event}`);
      fastify.log.info(`📝 Resource: ${body.resource}`);

      // Handle product webhooks - automatically save to database
      const isProductWebhook = body.resource === 'product' || body.event === 'product.created' || body.event === 'product.updated';

      if (isProductWebhook && body.product) {
        fastify.log.info('📦 === PRODUCT WEBHOOK DETECTED ===');
        fastify.log.info(`📋 Product event: ${body.event}`);
        fastify.log.info(`📋 Product ID: ${body.product.id}`);
        fastify.log.info(`📋 Product title: ${body.product.title}`);

        try {
          const fluidShop = request.headers['x-fluid-shop'] as string;

          if (fluidShop) {
            fastify.log.info(`🏪 Found fluid shop header: ${fluidShop}`);

            // Find installation by fluid shop
            const installationResult = await prisma.$queryRaw`
              SELECT i.id as "installationId", i."fluidId", c.name as "companyName"
              FROM installations i
              JOIN companies c ON i."companyId" = c.id
              WHERE c."fluidShop" = ${fluidShop} AND i."isActive" = true
              LIMIT 1
            ` as any[];

            if (installationResult && installationResult.length > 0) {
              const installation = installationResult[0];

              fastify.log.info(`💾 Saving product to installationId: ${installation.installationId}`);

              // Extract description - Fluid sends it as an object with a 'body' field, or use 'stripped' field
              let cleanDescription = null;
              if (body.product.stripped) {
                // Use the pre-stripped description if available
                cleanDescription = body.product.stripped;
              } else if (body.product.description) {
                // Handle both object format and string format
                if (typeof body.product.description === 'object' && body.product.description.body) {
                  cleanDescription = body.product.description.body;
                } else if (typeof body.product.description === 'string') {
                  cleanDescription = body.product.description.replace(/<[^>]*>/g, '');
                }
              }

              // Insert or update product in database
              await prisma.$executeRaw`
                INSERT INTO products (
                  id, "installationId", "fluidProductId", title, sku, description,
                  "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
                ) VALUES (
                  gen_random_uuid(), ${installation.installationId}, ${body.product.id.toString()},
                  ${body.product.title}, ${body.product.sku || null}, ${cleanDescription},
                  ${body.product.image_url || body.product.imageUrl || null},
                  ${body.product.status || null},
                  ${body.product.price || null},
                  ${body.product.in_stock ?? true},
                  ${body.product.public ?? true}, NOW(), NOW()
                )
                ON CONFLICT ("installationId", "fluidProductId")
                DO UPDATE SET
                  title = EXCLUDED.title,
                  sku = EXCLUDED.sku,
                  description = EXCLUDED.description,
                  "imageUrl" = EXCLUDED."imageUrl",
                  status = EXCLUDED.status,
                  price = EXCLUDED.price,
                  "inStock" = EXCLUDED."inStock",
                  public = EXCLUDED.public,
                  "updatedAt" = NOW()
              `;

              fastify.log.info(`✅ Product ${body.product.id} automatically saved to database for ${installation.companyName}`);

              // Mirror the product into the Meta Commerce Manager catalog so the
              // WhatsApp storefront stays in sync. Fire-and-forget: catalog
              // failures never block Fluid webhook processing.
              setImmediate(async () => {
                try {
                  const configs = await prisma.$queryRaw`
                    SELECT "phoneNumberId", "accessToken", "catalogId"
                    FROM whatsapp_configs
                    WHERE "installationId" = ${installation.installationId}
                    LIMIT 1
                  ` as any[];

                  const tenant = configs.length
                    ? { phoneNumberId: configs[0].phoneNumberId, accessToken: configs[0].accessToken, catalogId: configs[0].catalogId }
                    : WhatsAppService.envTenant();

                  if (!tenant.catalogId || !tenant.accessToken) return; // WhatsApp commerce not configured for this tenant

                  await WhatsAppService.syncProductToCatalog(tenant, {
                    retailerId: body.product.sku || body.product.id.toString(),
                    title: body.product.title,
                    description: cleanDescription,
                    priceKes: body.product.price || null,
                    imageUrl: body.product.image_url || body.product.imageUrl || null,
                    inStock: body.product.in_stock ?? true
                  });
                  fastify.log.info(`🛍️ Product ${body.product.id} synced to WhatsApp catalog ${tenant.catalogId}`);
                } catch (catalogError) {
                  fastify.log.warn(`⚠️ WhatsApp catalog sync failed for product ${body.product.id}: ${catalogError}`);
                }
              });
            } else {
              fastify.log.warn(`⚠️ No installation found for fluid shop: ${fluidShop}`);
            }
          } else {
            fastify.log.warn(`⚠️ No x-fluid-shop header found in webhook`);
          }
        } catch (dbError) {
          fastify.log.error(`❌ Failed to save product webhook to database: ${dbError}`);
        }
      }

      // Handle order webhooks - automatically save to database
      const isOrderWebhook = body.resource === 'order' ||
        ['created', 'completed', 'updated', 'shipped', 'cancelled', 'refunded'].includes(body.event);

      if (isOrderWebhook) {
        fastify.log.info('🛒 === ORDER WEBHOOK DETECTED ===');
        fastify.log.info(`📋 Order event: ${body.event}`);
        fastify.log.info(`📋 Event identifier: ${body.event_identifier || 'N/A'}`);
        fastify.log.info(`📋 Resource: ${body.resource}`);

        if (body.order) {
          fastify.log.info(`📦 Order data: ${JSON.stringify(body.order, null, 2)}`);
          fastify.log.info(`💰 Order total: ${body.order.total || body.order.amount || 'N/A'}`);
          fastify.log.info(`📧 Customer: ${body.order.customer_email || body.order.customer?.email || 'N/A'}`);
          fastify.log.info(`🏷️ Order tags: ${JSON.stringify(body.order.tags || [])}`);

          // Try to save order to database automatically
          try {
            // Find the installation for this order based on company info or headers
            const fluidShop = request.headers['x-fluid-shop'] as string;

            if (fluidShop) {
              fastify.log.info(`🏪 Found fluid shop header: ${fluidShop}`);

              // Find installation by fluid shop
              const installationResult = await prisma.$queryRaw`
                SELECT i.id as "installationId", i."fluidId", c.name as "companyName"
                FROM installations i
                JOIN companies c ON i."companyId" = c.id
                WHERE c."fluidShop" = ${fluidShop} AND i."isActive" = true
                LIMIT 1
              ` as any[];

              if (installationResult && installationResult.length > 0) {
                const installation = installationResult[0];

                // Prepare order data for database
                const customerEmail = body.order.customer_email || body.order.customer?.email || null;
                const customerName = body.order.customer?.name ||
                  (body.order.customer_first_name && body.order.customer_last_name
                    ? `${body.order.customer_first_name} ${body.order.customer_last_name}`
                    : body.order.customer_first_name || body.order.customer_last_name || null);

                // Insert or update order in database
                await prisma.$executeRaw`
                  INSERT INTO orders (
                    id, "installationId", "fluidOrderId", "orderNumber", amount, status,
                    "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
                  ) VALUES (
                    gen_random_uuid(), ${installation.installationId}, ${body.order.id.toString()},
                    ${body.order.order_number || body.order.number || null},
                    ${body.order.total || body.order.amount || null},
                    ${body.order.status || body.order.order_status || null},
                    ${customerEmail}, ${customerName},
                    ${body.order.items_count || body.order.line_items?.length || null}::integer,
                    ${JSON.stringify(body.order)}::jsonb, NOW(), NOW()
                  )
                  ON CONFLICT ("installationId", "fluidOrderId")
                  DO UPDATE SET
                    "orderNumber" = EXCLUDED."orderNumber",
                    amount = EXCLUDED.amount,
                    status = EXCLUDED.status,
                    "customerEmail" = EXCLUDED."customerEmail",
                    "customerName" = EXCLUDED."customerName",
                    "itemsCount" = EXCLUDED."itemsCount",
                    "orderData" = EXCLUDED."orderData",
                    "updatedAt" = NOW()
                `;

                fastify.log.info(`✅ Order ${body.order.id} automatically saved to database for ${installation.companyName}`);
              } else {
                fastify.log.warn(`⚠️ No installation found for fluid shop: ${fluidShop}`);
              }
            } else {
              fastify.log.warn(`⚠️ No x-fluid-shop header found in webhook`);
            }
          } catch (dbError) {
            fastify.log.error(`❌ Failed to save order webhook to database: ${dbError}`);
          }
        }
      }

      // Handle customer webhooks - automatically save to database
      const isCustomerWebhook = body.resource === 'customer' || 
        ['customer.created', 'customer.updated', 'customer.destroyed'].includes(body.event);

      if (isCustomerWebhook) {
        fastify.log.info('👤 === CUSTOMER WEBHOOK DETECTED ===');
        fastify.log.info(`📋 Customer event: ${body.event}`);
        fastify.log.info(`📋 Event identifier: ${body.event_identifier || 'N/A'}`);
        fastify.log.info(`📋 Resource: ${body.resource}`);

        if (body.customer) {
          fastify.log.info(`👤 Customer data: ${JSON.stringify(body.customer, null, 2)}`);
          fastify.log.info(`📧 Customer email: ${body.customer.email || 'N/A'}`);
          fastify.log.info(`🏷️ Customer tags: ${JSON.stringify(body.customer.tags || [])}`);

          // Try to save customer to database automatically
          try {
            const fluidShop = request.headers['x-fluid-shop'] as string;
            if (fluidShop) {
              const installation = await prisma.$queryRaw`
                SELECT i.id, i."fluidId", c.name as "companyName"
                FROM installations i
                JOIN companies c ON i."companyId" = c.id
                WHERE c."fluidShop" = ${fluidShop} AND i."isActive" = true
                LIMIT 1
              ` as any[];

              if (installation && installation.length > 0) {
                const install = installation[0];
                // Save customer data to database
                await prisma.$executeRaw`
                  INSERT INTO customers (
                    id, "installationId", "fluidCustomerId", email, "firstName", "lastName",
                    phone, "externalId", tags, "createdAt", "updatedAt"
                  ) VALUES (
                    gen_random_uuid(), ${install.id}, ${body.customer.id.toString()}, 
                    ${body.customer.email || null}, ${body.customer.first_name || null}, 
                    ${body.customer.last_name || null}, ${body.customer.phone || null},
                    ${body.customer.external_id || null}, ${JSON.stringify(body.customer.tags || [])},
                    NOW(), NOW()
                  )
                  ON CONFLICT ("installationId", "fluidCustomerId")
                  DO UPDATE SET
                    email = EXCLUDED.email,
                    "firstName" = EXCLUDED."firstName",
                    "lastName" = EXCLUDED."lastName",
                    phone = EXCLUDED.phone,
                    "externalId" = EXCLUDED."externalId",
                    tags = EXCLUDED.tags,
                    "updatedAt" = NOW()
                `;
                fastify.log.info(`✅ Customer ${body.customer.id} automatically saved to database for ${install.companyName}`);
              } else {
                fastify.log.warn(`⚠️ No installation found for fluid shop: ${fluidShop}`);
              }
            } else {
              fastify.log.warn(`⚠️ No x-fluid-shop header found in webhook`);
            }
          } catch (dbError) {
            fastify.log.error(`❌ Failed to save customer webhook to database: ${dbError}`);
          }
        }
      }

      // Handle rep webhooks - automatically save to database
      const isRepWebhook = body.resource === 'rep' || 
        ['rep.created', 'rep.updated', 'rep.destroyed'].includes(body.event);

      if (isRepWebhook) {
        fastify.log.info('👥 === REP WEBHOOK DETECTED ===');
        fastify.log.info(`📋 Rep event: ${body.event}`);
        fastify.log.info(`📋 Event identifier: ${body.event_identifier || 'N/A'}`);
        fastify.log.info(`📋 Resource: ${body.resource}`);

        if (body.rep) {
          fastify.log.info(`👥 Rep data: ${JSON.stringify(body.rep, null, 2)}`);
          fastify.log.info(`📧 Rep email: ${body.rep.email || 'N/A'}`);
          fastify.log.info(`👤 Rep name: ${body.rep.first_name || ''} ${body.rep.last_name || ''}`);

          // Try to save rep to database automatically
          try {
            const fluidShop = request.headers['x-fluid-shop'] as string;
            if (fluidShop) {
              const installation = await prisma.$queryRaw`
                SELECT i.id, i."fluidId", c.name as "companyName"
                FROM installations i
                JOIN companies c ON i."companyId" = c.id
                WHERE c."fluidShop" = ${fluidShop} AND i."isActive" = true
                LIMIT 1
              ` as any[];

              if (installation && installation.length > 0) {
                const install = installation[0];
                // Save rep data to database
                await prisma.$executeRaw`
                  INSERT INTO reps (
                    id, "installationId", "fluidRepId", "firstName", "lastName", email, phone,
                    active, "externalId", username, "shareGuid", "imageUrl", roles,
                    "countryCode", "languageCode", "computedFullName", "computedEmail",
                    "customerId", "createdAt", "updatedAt"
                  ) VALUES (
                    gen_random_uuid(), ${install.id}, ${body.rep.id.toString()},
                    ${body.rep.first_name}, ${body.rep.last_name}, ${body.rep.email || null},
                    ${body.rep.phone || null}, ${body.rep.active ?? true},
                    ${body.rep.external_id || null}, ${body.rep.username || null},
                    ${body.rep.share_guid || null}, ${body.rep.image_url || null},
                    ${body.rep.roles || 'user'}, ${body.rep.country_code || null},
                    ${body.rep.language_code || null}, ${body.rep.computed_full_name || null},
                    ${body.rep.computed_email || null}, ${body.rep.customer_id || null},
                    NOW(), NOW()
                  )
                  ON CONFLICT ("installationId", "fluidRepId")
                  DO UPDATE SET
                    "firstName" = EXCLUDED."firstName",
                    "lastName" = EXCLUDED."lastName",
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    active = EXCLUDED.active,
                    "externalId" = EXCLUDED."externalId",
                    username = EXCLUDED.username,
                    "shareGuid" = EXCLUDED."shareGuid",
                    "imageUrl" = EXCLUDED."imageUrl",
                    roles = EXCLUDED.roles,
                    "countryCode" = EXCLUDED."countryCode",
                    "languageCode" = EXCLUDED."languageCode",
                    "computedFullName" = EXCLUDED."computedFullName",
                    "computedEmail" = EXCLUDED."computedEmail",
                    "customerId" = EXCLUDED."customerId",
                    "updatedAt" = NOW()
                `;
                fastify.log.info(`✅ Rep ${body.rep.id} automatically saved to database for ${install.companyName}`);
              } else {
                fastify.log.warn(`⚠️ No installation found for fluid shop: ${fluidShop}`);
              }
            } else {
              fastify.log.warn(`⚠️ No x-fluid-shop header found in webhook`);
            }
          } catch (dbError) {
            fastify.log.error(`❌ Failed to save rep webhook to database: ${dbError}`);
          }
        }
      }

      // Check for authentication headers and verify webhook authenticity
      const authHeader = request.headers['auth-token'] || request.headers['x-auth-token'] || request.headers['authorization'];
      if (authHeader) {
        fastify.log.info(`🔐 Auth header found: ${typeof authHeader === 'string' ? authHeader.substring(0, 20) + '...' : authHeader}`);

        // TODO: Verify webhook auth_token against stored webhook configuration
        // For now, we log it for debugging but don't block processing
        fastify.log.info(`🔒 Webhook authentication detected - consider adding verification for production`);
      }

      // Handle installation events with immediate success response, then async processing
      if (body.event === 'installed') {
        const { company } = body;

        fastify.log.info('🎉 === DROPLET INSTALLATION WEBHOOK RECEIVED ===');
        fastify.log.info(`🏢 Company: ${company.name} (${company.fluid_shop})`);
        fastify.log.info(`🆔 Installation UUID: ${company.droplet_installation_uuid}`);
        fastify.log.info(`🔑 Auth Token: ${company.authentication_token ? company.authentication_token.substring(0, 15) + '...' : 'None'}`);

        // IMMEDIATE SUCCESS RESPONSE TO FLUID - Fix timing issue
        reply.send({ success: true, message: 'Droplet installation started' });

        // Process installation asynchronously to avoid Fluid timeout
        setImmediate(async () => {
          try {

        // Log ALL company fields available
        fastify.log.info('🏢 === COMPANY DATA ANALYSIS ===');
        fastify.log.info(`🔑 All company keys: ${Object.keys(company || {}).join(', ')}`);
        fastify.log.info(`📊 Company data: ${JSON.stringify(company, null, 2)}`);

        // Check for all possible token fields
        const tokenFields = [
          'authentication_token',
          'webhook_verification_token',
          'company_droplet_uuid',
          'droplet_installation_uuid',
          'access_token',
          'api_token',
          'droplet_token'
        ];

        tokenFields.forEach(field => {
          if (company && company[field]) {
            fastify.log.info(`🎟️ Found ${field}: ${company[field].substring(0, 15)}...`);
          }
        });

        if (company.authentication_token?.startsWith('dit_')) {
          fastify.log.info('✅ Received dit_ token from Fluid webhook - this is the correct token type for droplet installations');
        }


        // Create or update company using raw SQL to handle the new fluid_shop column
        const companyRecord = await prisma.$queryRaw`
          INSERT INTO companies (id, "fluidId", name, "logoUrl", "fluidShop", "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${company.fluid_company_id.toString()}, ${company.name}, null, ${company.fluid_shop}, NOW(), NOW())
          ON CONFLICT ("fluidId")
          DO UPDATE SET
            name = EXCLUDED.name,
            "fluidShop" = EXCLUDED."fluidShop",
            "updatedAt" = NOW()
          RETURNING id, "fluidId", name, "fluidShop"
        ` as any[];

        const companyData = companyRecord[0];

        // Get the company API token (cdrtkn_) by calling the droplet installation endpoint
        // According to Fluid docs: we need to call /api/droplet_installations/{uuid} to get cdrtkn_ token
        let companyApiToken = company.authentication_token; // fallback to dit_ token

        try {
          // Extract subdomain from fluid_shop (e.g., "myco" from "myco.fluid.app")
          const subdomain = company.fluid_shop ? company.fluid_shop.replace('.fluid.app', '') : null;

          if (subdomain && company.droplet_installation_uuid) {
            // Use the correct API pattern from Fluid documentation
            const installationEndpoint = `https://${subdomain}.fluid.app/api/droplet_installations/${company.droplet_installation_uuid}`;

            fastify.log.info(`🔍 Fetching cdrtkn_ token from: ${installationEndpoint}`);

            const installationResponse = await fetch(installationEndpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${company.authentication_token}`,
                'Content-Type': 'application/json'
              }
            });

            if (installationResponse.ok) {
              const installationData: any = await installationResponse.json();
              fastify.log.info(`✅ Got installation data from Fluid API`);

              // Extract the authentication token from the response
              // The response structure is: { droplet_installation: { authentication_token: "..." } }
              const authToken = installationData.droplet_installation?.authentication_token || installationData.authentication_token;

              if (authToken) {
                companyApiToken = authToken;
                if (authToken.startsWith('dit_')) {
                  fastify.log.info(`✅ Successfully obtained dit_ token: ${authToken.substring(0, 15)}...`);
                  fastify.log.info(`📝 dit_ tokens are the correct format for droplet installations`);
                } else if (authToken.startsWith('cdrtkn_')) {
                  fastify.log.info(`✅ Got cdrtkn_ token from Fluid API: ${authToken.substring(0, 15)}...`);
                } else {
                  fastify.log.warn(`⚠️ Unknown token format: ${authToken.substring(0, 10)}...`);
                }
              } else {
                fastify.log.warn(`⚠️ No authentication token found in installation response`);
                fastify.log.warn(`Raw installation response: ${JSON.stringify(installationData, null, 2)}`);
              }
            } else {
              const errorText = await installationResponse.text();
              fastify.log.error(`❌ Failed to fetch installation: ${installationResponse.status} - ${errorText}`);
            }
          } else {
            fastify.log.warn(`⚠️ Missing subdomain or installation UUID - cannot fetch cdrtkn_ token`);
          }
        } catch (error) {
          fastify.log.error(`Error fetching company API token: ${error}`);
        }

        // Capture additional tokens if available
        const webhookVerificationToken = company.webhook_verification_token || null;
        const companyDropletUuid = company.company_droplet_uuid || null;

        // Log what we're capturing
        fastify.log.info('💾 === STORING INSTALLATION DATA ===');
        fastify.log.info(`🏢 Company ID: ${companyData.id}`);
        fastify.log.info(`🆔 Installation ID: ${company.droplet_installation_uuid}`);
        fastify.log.info(`🎟️ Auth Token: ${companyApiToken ? companyApiToken.substring(0, 15) + '...' : 'None'}`);
        fastify.log.info(`🔐 Webhook Token: ${webhookVerificationToken ? webhookVerificationToken.substring(0, 15) + '...' : 'None'}`);
        fastify.log.info(`🎯 Company Droplet UUID: ${companyDropletUuid || 'None'}`);

        // Create or update installation using raw SQL to handle all new columns
        const installationResult = await prisma.$queryRaw`
          INSERT INTO installations (
            id, "companyId", "fluidId", "authenticationToken",
            "webhookVerificationToken", "companyDropletUuid", "isActive", "createdAt", "updatedAt"
          )
          VALUES (
            ${randomUUID()}, ${companyData.id}, ${company.droplet_installation_uuid}, ${companyApiToken},
            ${webhookVerificationToken}, ${companyDropletUuid}, true, NOW(), NOW()
          )
          ON CONFLICT ("fluidId")
          DO UPDATE SET
            "isActive" = true,
            "authenticationToken" = ${companyApiToken},
            "webhookVerificationToken" = ${webhookVerificationToken},
            "companyDropletUuid" = ${companyDropletUuid},
            "updatedAt" = NOW()
          RETURNING id, "fluidId", "isActive", "authenticationToken", "webhookVerificationToken", "companyDropletUuid"
        ` as any[];

            const installationData = installationResult[0];
            fastify.log.info('✅ === INSTALLATION CREATED/UPDATED ===');
            fastify.log.info(`🆔 Installation ID (fluidId): ${installationData.fluidId}`);
            fastify.log.info(`🏢 Company: ${companyData.name} (${companyData.fluidShop})`);
            fastify.log.info(`🔑 Has Auth Token: ${!!installationData.authenticationToken}`);
            fastify.log.info(`✅ Active: ${installationData.isActive}`);

            // Register webhooks asynchronously in the background
            const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001'
            const webhookUrl = WebhookRegistrationService.generateWebhookUrl(baseUrl)

            fastify.log.info(`🔗 Scheduling webhook registration for installation: ${company.droplet_installation_uuid}`)
            fastify.log.info(`📍 Webhook endpoint: ${webhookUrl}`)
            fastify.log.info(`📍 Base URL used: ${baseUrl}`)

            // Fire and forget - register webhooks in background
            WebhookRegistrationService.registerDropletWebhooks(
              companyApiToken,
              webhookUrl,
              fastify.log
            ).then((registrationResult) => {
              fastify.log.info(`✅ Background webhook registration completed: ${registrationResult.success} success, ${registrationResult.failed} failed`)

              if (registrationResult.errors.length > 0) {
                fastify.log.warn(`⚠️ Webhook registration errors: ${registrationResult.errors.join(', ')}`)
              }
            }).catch((webhookError) => {
              fastify.log.error(`❌ Failed to register webhooks in background: ${webhookError}`)
              // Installation already succeeded, webhooks can be registered manually if needed
            })

            fastify.log.info('✅ Droplet installation completed successfully')
          } catch (error) {
            fastify.log.error(`❌ Async installation processing failed: ${error}`)
            fastify.log.error(`❌ Installation data that failed: ${JSON.stringify({
              company: company.name,
              installation_uuid: company.droplet_installation_uuid,
              fluid_shop: company.fluid_shop,
              auth_token: company.authentication_token ? company.authentication_token.substring(0, 15) + '...' : 'None'
            }, null, 2)}`)
          }
        });

        return; // Exit early to prevent double response
      }

      // Handle uninstallation events
      if (body.event === 'uninstalled') {
        const { company } = body;


        // Deactivate the installation using the correct database schema
        await prisma.$queryRaw`
          UPDATE installations
          SET "isActive" = false, "updatedAt" = NOW()
          WHERE "fluidId" = ${company.droplet_installation_uuid}
          RETURNING "fluidId"
        `;

        // info logs removed

      }

      return { status: 'ok' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });
}