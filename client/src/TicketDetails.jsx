import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "./api.js";

const formatStatus = (status) => {
  if (!status) return "";
  if (status === "open") return "PENDING";
  return status.replace(/_/g, " ").toUpperCase();
};

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadTicket = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/tickets/${id}`);
        if (isMounted) {
          setTicket(data);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Failed to load ticket details");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTicket();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const latestQuote = useMemo(() => {
    if (!ticket?.quotes || ticket.quotes.length === 0) return null;
    return ticket.quotes[ticket.quotes.length - 1];
  }, [ticket]);

  if (loading) {
    return (
      <section className="section">
        <div className="card">
          <div className="note">Loading ticket details...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="card">
          <div className="note">{error}</div>
          <button className="btn" type="button" onClick={() => navigate(-1)}>Back</button>
        </div>
      </section>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <section className="section">
      <div className="ticket-details">
        <div className="card">
          <div className="ticket-details-header">
            <div>
              <h2>Ticket {ticket.ticketId}</h2>
              <div className="note">Created {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "-"}</div>
            </div>
            <div className="status">{formatStatus(ticket.status)}</div>
          </div>
          <div className="detail-grid">
            <div>
              <div className="detail-label">Customer</div>
              <div className="detail-value">{ticket.customerName || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Origin</div>
              <div className="detail-value">{ticket.origin}</div>
            </div>
            <div>
              <div className="detail-label">Destination</div>
              <div className="detail-value">{ticket.destination}</div>
            </div>
            <div>
              <div className="detail-label">Cargo Type</div>
              <div className="detail-value">{ticket.cargoType}</div>
            </div>
            <div>
              <div className="detail-label">Shipper ID</div>
              <div className="detail-value">{ticket.shipperIdStatus || "-"}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Shipment details</h3>
          {ticket.loads?.length ? (
            <div className="load-list">
              {ticket.loads.map((load, idx) => (
                <div className="load-card" key={`${ticket.ticketId}-load-${idx}`}>
                  <div className="load-header">
                    <div className="note">Load {idx + 1}</div>
                    <div className="note">{load.summary || ""}</div>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <div className="detail-label">Units</div>
                      <div className="detail-value">{load.unitCount}</div>
                    </div>
                    <div>
                      <div className="detail-label">Weight per unit</div>
                      <div className="detail-value">{load.weightPerUnit} kg</div>
                    </div>
                    <div>
                      <div className="detail-label">Total weight</div>
                      <div className="detail-value">{load.totalWeight} kg</div>
                    </div>
                    <div>
                      <div className="detail-label">Dimensions</div>
                      <div className="detail-value">
                        {load.dimensions?.length}x{load.dimensions?.width}x{load.dimensions?.height} {load.dimensions?.unit}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="note">No load details available.</div>
          )}
        </div>

        <div className="card">
          <h3>Quote details</h3>
          {latestQuote ? (
            <div className="detail-grid">
              <div>
                <div className="detail-label">Carrier</div>
                <div className="detail-value">{latestQuote.carrier}</div>
              </div>
              <div>
                <div className="detail-label">Service</div>
                <div className="detail-value">{latestQuote.serviceType || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Rate</div>
                <div className="detail-value">{latestQuote.rate} {latestQuote.currency}</div>
              </div>
              <div>
                <div className="detail-label">Transit Time</div>
                <div className="detail-value">{latestQuote.transitTime || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Validity</div>
                <div className="detail-value">{latestQuote.validity || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Quote Date</div>
                <div className="detail-value">{latestQuote.quoteDate || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Chargeable Weight</div>
                <div className="detail-value">{latestQuote.chargeableWeight || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Total Amount</div>
                <div className="detail-value">{latestQuote.totalAmount || "-"}</div>
              </div>
              <div>
                <div className="detail-label">Remarks</div>
                <div className="detail-value">{latestQuote.remarks || "-"}</div>
              </div>
            </div>
          ) : (
            <div className="note">No quote submitted yet.</div>
          )}
        </div>

        <div className="card">
          <h3>Booking details</h3>
          <div className="detail-grid">
            <div>
              <div className="detail-label">AWB</div>
              <div className="detail-value">{ticket.awbNumber || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Booked Date</div>
              <div className="detail-value">{ticket.bookedOn || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Final Rate</div>
              <div className="detail-value">{ticket.finalRate || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Booking Ref</div>
              <div className="detail-value">{ticket.booking?.reference || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Closed Notes</div>
              <div className="detail-value">{ticket.closingNotes || "-"}</div>
            </div>
            <div>
              <div className="detail-label">Proof</div>
              <div className="detail-value">{ticket.screenshotUrl || "-"}</div>
            </div>
          </div>
          <div className="flex">
            <button className="btn secondary" type="button" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      </div>
    </section>
  );
}
